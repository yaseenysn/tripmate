import { Router, Response } from 'express';
import { Settlement } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { calculateTripBalancesAndSettlements } from '../services/settlementService';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips/:id/settlements
router.get('/:id/settlements', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const { memberBalances, suggestedSettlements } = await calculateTripBalancesAndSettlements(tripId);

    const recordedSettlements = await Settlement.find({ tripId })
      .populate('fromUser', 'name avatar email')
      .populate('toUser', 'name avatar email')
      .sort({ createdAt: -1 });

    res.json({
      memberBalances,
      suggestedSettlements,
      recordedSettlements
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching settlements' });
  }
});

// POST /api/trips/:id/settlements/record - Create or mark settlement paid
router.post('/:id/settlements/record', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { fromUser, toUser, amount } = req.body;

    if (!fromUser || !toUser || !amount) {
      return res.status(400).json({ error: 'fromUser, toUser, and amount are required' });
    }

    const settlement = await Settlement.create({
      tripId,
      fromUser,
      toUser,
      amount: Number(amount),
      status: 'PAID',
      paidAt: new Date()
    });

    const populated = await Settlement.findById(settlement._id)
      .populate('fromUser', 'name avatar')
      .populate('toUser', 'name avatar');

    const payerName = (populated?.fromUser as any)?.name || 'Member';
    const payeeName = (populated?.toUser as any)?.name || 'Member';

    await logActivity(tripId, userId, 'SETTLEMENT_PAID', `marked settlement of ₹${amount} from ${payerName} to ${payeeName} as PAID`);
    await createNotification(toUser, 'Settlement Received', `${payerName} paid you ₹${amount} for trip settlement.`, 'SETTLEMENT', tripId);

    emitToTrip(tripId, 'settlement.updated', populated);

    res.status(201).json({ settlement: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error recording settlement' });
  }
});

// POST /api/trips/:id/settlements/:settlementId/pay
router.post('/:id/settlements/:settlementId/pay', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, settlementId } = req.params;

    const settlement = await Settlement.findById(settlementId)
      .populate('fromUser', 'name avatar')
      .populate('toUser', 'name avatar');

    if (!settlement || settlement.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    settlement.status = 'PAID';
    settlement.paidAt = new Date();
    await settlement.save();

    const payerName = (settlement.fromUser as any)?.name || 'Member';
    const payeeName = (settlement.toUser as any)?.name || 'Member';

    await logActivity(tripId, req.user!.userId, 'SETTLEMENT_PAID', `marked settlement of ₹${settlement.amount} from ${payerName} to ${payeeName} as PAID`);
    emitToTrip(tripId, 'settlement.updated', settlement);

    res.json({ settlement });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating settlement status' });
  }
});

export default router;
