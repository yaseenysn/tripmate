import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Expense, TripMember, Budget, Trip } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';

const router = Router();

// Helper to calculate participants split shares
// Helper to calculate participants split shares & status
const calculateShares = (
  amount: number,
  splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE',
  participantsInput: { userId: string; share?: number; percentage?: number; status?: 'PENDING' | 'PAID' }[],
  paidById?: string
) => {
  const payerIdStr = paidById ? paidById.toString() : '';

  if (splitType === 'EQUAL') {
    const count = participantsInput.length;
    const equalShare = count > 0 ? Math.round((amount / count) * 100) / 100 : 0;
    return participantsInput.map(p => {
      const uIdStr = p.userId.toString();
      const isPayer = payerIdStr && uIdStr === payerIdStr;
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: equalShare,
        percentage: Math.round((100 / count) * 10) / 10,
        status: p.status || (isPayer ? 'PAID' : 'PENDING')
      };
    });
  } else if (splitType === 'PERCENTAGE') {
    return participantsInput.map(p => {
      const pct = p.percentage || 0;
      const sh = Math.round((amount * (pct / 100)) * 100) / 100;
      const uIdStr = p.userId.toString();
      const isPayer = payerIdStr && uIdStr === payerIdStr;
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: sh,
        percentage: pct,
        status: p.status || (isPayer ? 'PAID' : 'PENDING')
      };
    });
  } else {
    // CUSTOM
    return participantsInput.map(p => {
      const uIdStr = p.userId.toString();
      const isPayer = payerIdStr && uIdStr === payerIdStr;
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: p.share !== undefined ? p.share : 0,
        percentage: amount > 0 ? Math.round(((p.share || 0) / amount) * 100) : 0,
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
router.post('/:id/expenses', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
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
router.patch('/:id/expenses/:expenseId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
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
router.post('/:id/expenses/:expenseId/pay-split', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
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

    participant.status = 'PAID';
    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name avatar email')
      .populate('participants.userId', 'name avatar email');

    const payerName = (populated?.paidBy as any)?.name || 'Member';

    await logActivity(
      tripId,
      currentUserId,
      'EXPENSE_SPLIT_PAID',
      `marked ₹${participant.share.toLocaleString()} share as paid to ${payerName} for "${expense.title}"`,
      { expenseId: expense._id, expense: populated, amount: expense.amount }
    );

    emitToTrip(tripId, 'expense.updated', populated);
    emitToTrip(tripId, 'settlement.updated', { tripId });

    res.json({ expense: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error marking split paid' });
  }
});

// DELETE /api/trips/:id/expenses/:expenseId
router.delete('/:id/expenses/:expenseId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
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

    await logActivity(tripId, req.user!.userId, 'EXPENSE_DELETED', `deleted expense "${title}"`);
    emitToTrip(tripId, 'expense.deleted', { expenseId });

    res.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting expense' });
  }
});

export default router;
