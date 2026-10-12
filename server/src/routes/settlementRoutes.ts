import { Router, Response } from 'express';
import { Settlement, Trip, User } from '../models';
import { authenticateToken } from '../middleware/auth';
import {
  requireTripMembership,
  requireNotClosedTrip,
  TripAuthRequest
} from '../middleware/tripAuth';
import {
  calculateTripBalancesAndSettlements,
  generateAuthoritativeTripReport
} from '../services/settlementService';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips/:id/settlements
router.get(
  '/:id/settlements',
  authenticateToken,
  requireTripMembership,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const tripId = req.params.id;
      const calculation = await calculateTripBalancesAndSettlements(tripId);

      const recordedSettlements = await Settlement.find({ tripId })
        .populate('fromUser', 'name avatar email')
        .populate('toUser', 'name avatar email')
        .sort({ createdAt: -1 });

      res.json({
        ...calculation,
        recordedSettlements
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error fetching settlements' });
    }
  }
);

// POST /api/trips/:id/settlements/record - Create or mark settlement paid
router.post(
  '/:id/settlements/record',
  authenticateToken,
  requireTripMembership,
  requireNotClosedTrip,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const tripId = req.params.id;
      const userId = req.user!.userId;
      const {
        fromUser,
        toUser,
        amount,
        notes,
        reference,
        idempotencyKey,
        settlementId
      } = req.body;

      if (!fromUser || !toUser || !amount || Number(amount) <= 0) {
        return res.status(400).json({
          error: 'fromUser, toUser, and a positive amount are required'
        });
      }

      if (fromUser.toString() === toUser.toString()) {
        return res.status(400).json({
          error: 'Payer and receiver cannot be the same member'
        });
      }

      // Authorization check: User must be payer, receiver, or trip ADMIN
      const isAdmin = req.tripMember?.role === 'ADMIN';
      const isParticipant =
        userId.toString() === fromUser.toString() ||
        userId.toString() === toUser.toString();

      if (!isAdmin && !isParticipant) {
        return res.status(403).json({
          error: 'Only the payer, receiver, or a trip admin can record this settlement payment.'
        });
      }

      const numAmount = Math.round(Number(amount) * 100) / 100;

      // 1. Idempotency Check by explicit key
      if (idempotencyKey) {
        const existingWithKey = await Settlement.findOne({
          tripId,
          idempotencyKey
        })
          .populate('fromUser', 'name avatar email')
          .populate('toUser', 'name avatar email');

        if (existingWithKey) {
          return res.status(200).json({
            settlement: existingWithKey,
            idempotent: true
          });
        }
      }

      // 2. Prevent duplicate rapid submission (within 5 seconds)
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const recentDuplicate = await Settlement.findOne({
        tripId,
        fromUser,
        toUser,
        amount: numAmount,
        status: 'PAID',
        createdAt: { $gte: fiveSecondsAgo }
      })
        .populate('fromUser', 'name avatar email')
        .populate('toUser', 'name avatar email');

      if (recentDuplicate) {
        return res.status(200).json({
          settlement: recentDuplicate,
          idempotent: true
        });
      }

      let settlementDoc;

      // 3. If an existing pending settlement was targeted, update it
      if (settlementId) {
        settlementDoc = await Settlement.findById(settlementId);
        if (settlementDoc && settlementDoc.tripId.toString() === tripId) {
          settlementDoc.status = 'PAID';
          settlementDoc.paidAt = new Date();
          settlementDoc.amount = numAmount;
          if (notes) settlementDoc.notes = notes;
          if (reference) settlementDoc.reference = reference;
          if (idempotencyKey) settlementDoc.idempotencyKey = idempotencyKey;
          await settlementDoc.save();
        }
      }

      if (!settlementDoc) {
        // Create new confirmed settlement record
        settlementDoc = await Settlement.create({
          tripId,
          fromUser,
          toUser,
          amount: numAmount,
          status: 'PAID',
          paidAt: new Date(),
          notes: notes || '',
          reference: reference || '',
          idempotencyKey: idempotencyKey || undefined
        });
      }

      const populated = await Settlement.findById(settlementDoc._id)
        .populate('fromUser', 'name avatar email')
        .populate('toUser', 'name avatar email');

      const payerName = (populated?.fromUser as any)?.name || 'Member';
      const payeeName = (populated?.toUser as any)?.name || 'Member';

      await logActivity(
        tripId,
        userId,
        'SETTLEMENT_PAID',
        `confirmed settlement of ₹${numAmount.toLocaleString()} from ${payerName} to ${payeeName}`
      );

      await createNotification(
        toUser,
        'Settlement Received',
        `${payerName} paid you ₹${numAmount.toLocaleString()} for trip settlement.`,
        'SETTLEMENT',
        tripId
      );

      // Recalculate trip balances and check if trip is now fully SETTLED
      const freshCalculation = await calculateTripBalancesAndSettlements(tripId);
      const trip = await Trip.findById(tripId);

      if (trip) {
        trip.settlementStatus = freshCalculation.settlementStatus;
        if (freshCalculation.settlementStatus === 'SETTLED' && trip.status === 'COMPLETED') {
          trip.status = 'SETTLED';
        }
        await trip.save();
        emitToTrip(tripId, 'trip.updated', trip);
      }

      emitToTrip(tripId, 'settlement.updated', {
        settlement: populated,
        calculation: freshCalculation
      });

      res.status(201).json({
        settlement: populated,
        calculation: freshCalculation
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error recording settlement' });
    }
  }
);

// POST /api/trips/:id/settlements/:settlementId/pay
router.post(
  '/:id/settlements/:settlementId/pay',
  authenticateToken,
  requireTripMembership,
  requireNotClosedTrip,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const { id: tripId, settlementId } = req.params;

      const settlement = await Settlement.findById(settlementId)
        .populate('fromUser', 'name avatar email')
        .populate('toUser', 'name avatar email');

      if (!settlement || settlement.tripId.toString() !== tripId) {
        return res.status(404).json({ error: 'Settlement not found' });
      }

      // If already paid, return safely without duplicate activity
      if (settlement.status === 'PAID') {
        return res.json({ settlement, alreadyPaid: true });
      }

      settlement.status = 'PAID';
      settlement.paidAt = new Date();
      await settlement.save();

      const payerName = (settlement.fromUser as any)?.name || 'Member';
      const payeeName = (settlement.toUser as any)?.name || 'Member';

      await logActivity(
        tripId,
        req.user!.userId,
        'SETTLEMENT_PAID',
        `marked settlement of ₹${settlement.amount.toLocaleString()} from ${payerName} to ${payeeName} as PAID`
      );

      // Recalculate and update trip status if needed
      const freshCalculation = await calculateTripBalancesAndSettlements(tripId);
      const trip = await Trip.findById(tripId);
      if (trip) {
        trip.settlementStatus = freshCalculation.settlementStatus;
        if (freshCalculation.settlementStatus === 'SETTLED' && trip.status === 'COMPLETED') {
          trip.status = 'SETTLED';
        }
        await trip.save();
        emitToTrip(tripId, 'trip.updated', trip);
      }

      emitToTrip(tripId, 'settlement.updated', {
        settlement,
        calculation: freshCalculation
      });

      res.json({ settlement, calculation: freshCalculation });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error updating settlement status' });
    }
  }
);

// GET /api/trips/:id/settlements/report
router.get(
  '/:id/settlements/report',
  authenticateToken,
  requireTripMembership,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const report = await generateAuthoritativeTripReport(req.params.id);
      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error generating report' });
    }
  }
);

export default router;
