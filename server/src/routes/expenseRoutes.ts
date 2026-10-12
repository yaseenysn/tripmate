import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Expense, TripMember, Budget, Trip, Activity, Settlement } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { calculateTripBalancesAndSettlements } from '../services/settlementService';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';

const router = Router();

// Helper to calculate participants split shares
// Helper to calculate participants split shares & status using integer paise
const calculateShares = (
  amount: number,
  splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE',
  participantsInput: { userId: string; share?: number; percentage?: number; status?: 'PENDING' | 'PAID' }[],
  paidById?: string
) => {
  const payerIdStr = paidById ? paidById.toString() : '';
  const totalAmountPaise = Math.round((Number(amount) || 0) * 100);
  const count = participantsInput.length;

  if (count === 0) return [];

  if (splitType === 'EQUAL') {
    const baseSharePaise = Math.floor(totalAmountPaise / count);
    const remainderPaise = totalAmountPaise % count;

    // Stable deterministic order (by userId string) so remainder allocation is predictable
    const sortedIndices = participantsInput
      .map((p, index) => ({ idStr: p.userId.toString(), index }))
      .sort((a, b) => a.idStr.localeCompare(b.idStr));

    const extraMap: Record<number, number> = {};
    for (let r = 0; r < remainderPaise; r++) {
      extraMap[sortedIndices[r].index] = 1;
    }

    return participantsInput.map((p, index) => {
      const uIdStr = p.userId.toString();
      const isPayer = payerIdStr && uIdStr === payerIdStr;
      const sharePaise = baseSharePaise + (extraMap[index] || 0);
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: sharePaise / 100,
        percentage: Math.round((100 / count) * 10) / 10,
        status: p.status || (isPayer ? 'PAID' : 'PENDING')
      };
    });
  } else if (splitType === 'PERCENTAGE') {
    let sumPaise = 0;
    const computed = participantsInput.map(p => {
      const pct = Number(p.percentage) || 0;
      const shPaise = Math.round((totalAmountPaise * pct) / 100);
      sumPaise += shPaise;
      const uIdStr = p.userId.toString();
      const isPayer = payerIdStr && uIdStr === payerIdStr;
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        sharePaise: shPaise,
        percentage: pct,
        status: p.status || (isPayer ? 'PAID' : 'PENDING')
      };
    });

    const totalPct = participantsInput.reduce((s, p) => s + (Number(p.percentage) || 0), 0);
    const diffPaise = totalAmountPaise - sumPaise;
    if (Math.abs(totalPct - 100) < 0.01 && diffPaise !== 0 && computed.length > 0) {
      let targetIdx = 0;
      let maxPct = -1;
      computed.forEach((c, idx) => {
        if (c.percentage > maxPct) {
          maxPct = c.percentage;
          targetIdx = idx;
        }
      });
      computed[targetIdx].sharePaise += diffPaise;
    }

    return computed.map(c => ({
      userId: c.userId,
      share: c.sharePaise / 100,
      percentage: c.percentage,
      status: c.status
    }));
  } else {
    // CUSTOM
    return participantsInput.map(p => {
      const uIdStr = p.userId.toString();
      const isPayer = payerIdStr && uIdStr === payerIdStr;
      const sh = p.share !== undefined ? Number(p.share) : 0;
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: Math.round(sh * 100) / 100,
        percentage: amount > 0 ? Math.round(((sh || 0) / amount) * 100) : 0,
        status: p.status || (isPayer ? 'PAID' : 'PENDING')
      };
    });
  }
};

// GET /api/trips/:id/expenses
router.get('/:id/expenses', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const expenses = await Expense.find({ tripId })
      .populate('paidBy', 'name avatar email')
      .populate('participants.userId', 'name avatar email')
      .sort({ date: -1, createdAt: -1 });

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({ expenses, totalSpent });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching expenses' });
  }
});

// POST /api/trips/:id/expenses
router.post('/:id/expenses', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { title, amount, category, date, paidBy, splitType, participants, notes, receiptUrl, receiptPublicId } = req.body;

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid title and positive amount are required' });
    }

    const numAmount = Number(amount);
    const payerId = paidBy || userId;
    const typeOfSplit = splitType || 'EQUAL';

    // If no participants specified, include all trip members
    let targetParticipants = participants;
    if (!targetParticipants || targetParticipants.length === 0) {
      const members = await TripMember.find({ tripId });
      targetParticipants = members.map(m => ({ userId: m.userId.toString() }));
    }

    const computedParticipants = calculateShares(numAmount, typeOfSplit, targetParticipants, payerId);

    const expense = await Expense.create({
      tripId,
      title,
      amount: numAmount,
      category: category || 'Miscellaneous',
      date: date ? new Date(date) : new Date(),
      paidBy: payerId,
      splitType: typeOfSplit,
      participants: computedParticipants,
      notes,
      receiptUrl,
      receiptPublicId,
      createdBy: userId
    });

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name avatar email')
      .populate('participants.userId', 'name avatar email');

    // Activity log
    const payerName = (populated?.paidBy as any)?.name || 'Someone';
    const currency = '₹';
    await logActivity(
      tripId,
      userId,
      'EXPENSE_ADDED',
      `added ${currency}${numAmount.toLocaleString()} ${category || 'expense'} "${title}" (Paid by ${payerName})`,
      { expenseId: expense._id, expense: populated }
    );

    // Check budget threshold warning (75%+ or 100%+)
    const allExpenses = await Expense.find({ tripId });
    const currentSpent = allExpenses.reduce((s, e) => s + e.amount, 0);
    const budgetDoc = await Budget.findOne({ tripId });

    if (budgetDoc && budgetDoc.totalBudget > 0) {
      const pct = (currentSpent / budgetDoc.totalBudget) * 100;
      if (pct >= 100) {
        await createNotification(
          userId,
          'Budget Alert: Exceeded!',
          `Trip spending (${currency}${currentSpent.toLocaleString()}) has exceeded total budget (${currency}${budgetDoc.totalBudget.toLocaleString()})!`,
          'WARNING',
          tripId
        );
      } else if (pct >= 75) {
        await createNotification(
          userId,
          'Budget Alert: 75% Used',
          `Trip spending reached ${Math.round(pct)}% of total budget (${currency}${budgetDoc.totalBudget.toLocaleString()}).`,
          'WARNING',
          tripId
        );
      }
    }

    emitToTrip(tripId, 'expense.created', populated);

    res.status(201).json({ expense: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating expense' });
  }
});

// PATCH /api/trips/:id/expenses/:expenseId
router.patch('/:id/expenses/:expenseId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, expenseId } = req.params;
    const { title, amount, category, date, paidBy, splitType, participants, notes, receiptUrl, receiptPublicId } = req.body;

    const expense = await Expense.findById(expenseId);
    if (!expense || expense.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Permission check: creator, payer, or admin
    const currentUserId = req.user!.userId;
    const isCreator = expense.createdBy.toString() === currentUserId;
    const isPayer = expense.paidBy.toString() === currentUserId;
    const memberDoc = await TripMember.findOne({ tripId, userId: currentUserId });
    const isAdmin = memberDoc?.role === 'ADMIN';

    if (!isCreator && !isPayer && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to edit this expense' });
    }

    const oldPublicId = expense.receiptPublicId;

    if (title !== undefined) expense.title = title;
    if (amount !== undefined) expense.amount = Number(amount);
    if (category !== undefined) expense.category = category;
    if (date !== undefined) expense.date = new Date(date);
    if (paidBy !== undefined) expense.paidBy = paidBy;
    if (splitType !== undefined) expense.splitType = splitType;
    if (notes !== undefined) expense.notes = notes;
    if (receiptUrl !== undefined) expense.receiptUrl = receiptUrl;
    if (receiptPublicId !== undefined) expense.receiptPublicId = receiptPublicId;

    if (oldPublicId && receiptPublicId && oldPublicId !== receiptPublicId) {
      await deleteFromCloudinary(oldPublicId, 'image');
      await deleteFromCloudinary(oldPublicId, 'raw');
    }

    if (participants || amount !== undefined || splitType !== undefined || paidBy !== undefined) {
      let targetParticipants = participants;
      if (!targetParticipants || targetParticipants.length === 0) {
        targetParticipants = expense.participants.map(p => ({
          userId: p.userId.toString(),
          share: p.share,
          percentage: p.percentage,
          status: p.status
        }));
      }
      expense.participants = calculateShares(
        expense.amount,
        expense.splitType,
        targetParticipants,
        expense.paidBy.toString()
      ) as any;
    }

    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name avatar email')
      .populate('participants.userId', 'name avatar email');

    await logActivity(
      tripId,
      req.user!.userId,
      'EXPENSE_UPDATED',
      `updated expense "${expense.title}"`,
      { expenseId: expense._id, expense: populated, amount: expense.amount }
    );
    emitToTrip(tripId, 'expense.updated', populated);

    res.json({ expense: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating expense' });
  }
});

// POST /api/trips/:id/expenses/:expenseId/pay-split
router.post('/:id/expenses/:expenseId/pay-split', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, expenseId } = req.params;
    const currentUserId = req.user!.userId;
    const targetUserId = req.body.userId || currentUserId;

    const expense = await Expense.findById(expenseId);
    if (!expense || expense.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const participant = expense.participants.find(
      p => p.userId.toString() === targetUserId.toString()
    );

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found in expense split' });
    }

    // Prevent duplicate payment for already paid split
    if (participant.status === 'PAID') {
      const populated = await Expense.findById(expense._id)
        .populate('paidBy', 'name avatar email')
        .populate('participants.userId', 'name avatar email');
      return res.json({ expense: populated });
    }

    participant.status = 'PAID';
    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name avatar email')
      .populate('participants.userId', 'name avatar email');

    // Record or update confirmed Settlement record for this expense split payment
    const payerIdStr = expense.paidBy.toString();
    const targetIdStr = targetUserId.toString();
    const splitKey = `split_${expense._id}_${targetIdStr}`;

    if (payerIdStr !== targetIdStr && participant.share > 0) {
      await Settlement.findOneAndUpdate(
        { tripId, idempotencyKey: splitKey },
        {
          tripId,
          fromUser: targetUserId,
          toUser: expense.paidBy,
          amount: participant.share,
          status: 'PAID',
          paidAt: new Date(),
          notes: `Split payment for "${expense.title}"`,
          idempotencyKey: splitKey
        },
        { upsert: true, new: true }
      );
    }

    // Update existing activity record for this expense in place so metadata.expense is fresh
    await Activity.updateMany(
      {
        tripId,
        $or: [
          { 'metadata.expenseId': expense._id },
          { 'metadata.expense._id': expense._id }
        ]
      },
      {
        $set: {
          'metadata.expense': populated
        }
      }
    );

    // Recalculate trip balances and status
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

    // Emit real-time updates to all connected trip members
    emitToTrip(tripId, 'expense.updated', populated);
    emitToTrip(tripId, 'settlement.updated', { tripId, calculation: freshCalculation });

    res.json({ expense: populated, calculation: freshCalculation });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error marking split paid' });
  }
});

// DELETE /api/trips/:id/expenses/:expenseId
router.delete('/:id/expenses/:expenseId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, expenseId } = req.params;

    const expense = await Expense.findById(expenseId);
    if (!expense || expense.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Permission check
    const currentUserId = req.user!.userId;
    const isCreator = expense.createdBy.toString() === currentUserId;
    const isPayer = expense.paidBy.toString() === currentUserId;
    const memberDoc = await TripMember.findOne({ tripId, userId: currentUserId });
    const isAdmin = memberDoc?.role === 'ADMIN';

    if (!isCreator && !isPayer && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this expense' });
    }

    if (expense.receiptPublicId) {
      await deleteFromCloudinary(expense.receiptPublicId, 'image');
      await deleteFromCloudinary(expense.receiptPublicId, 'raw');
    }

    const title = expense.title;
    await Expense.findByIdAndDelete(expenseId);

    // Also remove any settlement records linked to this expense's splits
    await Settlement.deleteMany({
      tripId,
      idempotencyKey: { $regex: `^split_${expenseId}_` }
    });

    // Clean up activity log items for this deleted expense so chat feed doesn't retain ghost cards
    await Activity.deleteMany({
      tripId,
      $or: [
        { 'metadata.expenseId': expenseId },
        { 'metadata.expenseId': new mongoose.Types.ObjectId(expenseId) },
        { 'metadata.expense._id': expenseId },
        { 'metadata.expense._id': new mongoose.Types.ObjectId(expenseId) }
      ]
    });

    await logActivity(tripId, req.user!.userId, 'EXPENSE_DELETED', `deleted expense "${title}"`);

    // Recalculate trip balances and status from remaining database records
    const freshCalculation = await calculateTripBalancesAndSettlements(tripId);
    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.settlementStatus = freshCalculation.settlementStatus;
      if (freshCalculation.settlementStatus === 'SETTLED' && trip.status === 'COMPLETED') {
        trip.status = 'SETTLED';
      } else if (freshCalculation.settlementStatus !== 'SETTLED' && trip.status === 'SETTLED') {
        trip.status = 'COMPLETED';
      }
      await trip.save();
      emitToTrip(tripId, 'trip.updated', trip);
    }

    emitToTrip(tripId, 'expense.deleted', { tripId, expenseId });
    emitToTrip(tripId, 'settlement.updated', { tripId, calculation: freshCalculation });

    res.json({
      message: 'Expense deleted successfully',
      tripId,
      expenseId,
      calculation: freshCalculation
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting expense' });
  }
});

export default router;
