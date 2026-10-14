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

// Helper to calculate participants split shares & status using integer paise
const calculateShares = (
  amount: number,
  splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE',
  participantsInput: {
    userId: string | mongoose.Types.ObjectId;
    share?: number;
    percentage?: number;
    paidAmount?: number;
    status?: string;
  }[],
  payerIdStr?: string,
  previousPayerIdStr?: string
) => {
  const payerIdString = payerIdStr ? payerIdStr.toString() : '';
  const totalAmountPaise = Math.round((Number(amount) || 0) * 100);
  const count = participantsInput.length;

  if (count === 0) return [];

  // Helper to determine paidAmount and status
  const resolveStatusAndPaid = (
    uIdStr: string,
    sharePaise: number,
    inputPaidAmount?: number,
    inputStatus?: string
  ) => {
    const isPayer = payerIdString && uIdStr === payerIdString;
    const share = sharePaise / 100;

    if (isPayer) {
      return {
        paidAmount: share,
        status: 'PAID' as const
      };
    }

    // If member was the previous payer, but is no longer the payer, their split paid to the new payer is 0
    if (previousPayerIdStr && uIdStr === previousPayerIdStr && uIdStr !== payerIdString) {
      return {
        paidAmount: 0,
        status: 'PENDING' as const
      };
    }

    const currentPaid = inputPaidAmount !== undefined
      ? Number(inputPaidAmount)
      : (inputStatus === 'PAID' ? share : 0);

    const paidAmount = Math.max(0, Math.round(currentPaid * 100) / 100);
    let status: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';

    if (paidAmount >= share && share > 0) {
      status = 'PAID';
    } else if (paidAmount > 0) {
      status = 'PARTIAL';
    } else {
      status = 'PENDING';
    }

    return { paidAmount, status };
  };

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
      const sharePaise = baseSharePaise + (extraMap[index] || 0);
      const { paidAmount, status } = resolveStatusAndPaid(uIdStr, sharePaise, p.paidAmount, p.status);

      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: sharePaise / 100,
        percentage: Math.round((100 / count) * 10) / 10,
        paidAmount,
        status
      };
    });
  } else if (splitType === 'PERCENTAGE') {
    const totalPct = participantsInput.reduce((s, p) => s + (Number(p.percentage) || 0), 0);
    // Validation: Total percentage must equal 100% within precision limit (0.01%)
    if (Math.abs(Math.round(totalPct * 100) - 10000) > 1) {
      throw new Error(`Participant percentages total ${totalPct.toFixed(2)}%, but must equal exactly 100%.`);
    }

    let sumPaise = 0;
    const computed = participantsInput.map(p => {
      const pct = Number(p.percentage) || 0;
      const shPaise = Math.floor((totalAmountPaise * pct) / 100);
      sumPaise += shPaise;
      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        sharePaise: shPaise,
        percentage: pct,
        paidAmount: p.paidAmount,
        status: p.status
      };
    });

    const diffPaise = totalAmountPaise - sumPaise;
    if (diffPaise !== 0 && computed.length > 0) {
      // Deterministic allocation of remainder to highest percentage (tie-break by userId string)
      let targetIdx = 0;
      let maxPct = -1;
      let targetIdStr = '';
      computed.forEach((c, idx) => {
        const uId = c.userId.toString();
        if (c.percentage > maxPct || (c.percentage === maxPct && uId.localeCompare(targetIdStr) < 0)) {
          maxPct = c.percentage;
          targetIdx = idx;
          targetIdStr = uId;
        }
      });
      computed[targetIdx].sharePaise += diffPaise;
    }

    return computed.map(c => {
      const uIdStr = c.userId.toString();
      const { paidAmount, status } = resolveStatusAndPaid(uIdStr, c.sharePaise, c.paidAmount, c.status);
      return {
        userId: c.userId,
        share: c.sharePaise / 100,
        percentage: c.percentage,
        paidAmount,
        status
      };
    });
  } else {
    // CUSTOM
    let sumPaise = 0;
    for (const p of participantsInput) {
      const sh = Number(p.share) || 0;
      if (sh < 0) {
        throw new Error('Participant custom share cannot be negative.');
      }
      sumPaise += Math.round(sh * 100);
    }

    // Validation: Custom shares must sum exactly to total amount in paise
    if (sumPaise !== totalAmountPaise) {
      throw new Error(
        `Participant shares (₹${(sumPaise / 100).toFixed(2)}) must equal the total expense amount (₹${(totalAmountPaise / 100).toFixed(2)}).`
      );
    }

    return participantsInput.map(p => {
      const uIdStr = p.userId.toString();
      const sh = p.share !== undefined ? Number(p.share) : 0;
      const sharePaise = Math.round(sh * 100);
      const { paidAmount, status } = resolveStatusAndPaid(uIdStr, sharePaise, p.paidAmount, p.status);

      return {
        userId: new mongoose.Types.ObjectId(p.userId),
        share: sharePaise / 100,
        percentage: totalAmountPaise > 0 ? Math.round((sharePaise / totalAmountPaise) * 1000) / 10 : 0,
        paidAmount,
        status
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

    let computedParticipants;
    try {
      computedParticipants = calculateShares(numAmount, typeOfSplit, targetParticipants, payerId);
    } catch (validationErr: any) {
      return res.status(400).json({ error: validationErr.message || 'Invalid expense split distribution' });
    }

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
    const oldPayerIdStr = expense.paidBy.toString();
    const isChangingPayer = paidBy !== undefined && paidBy.toString() !== oldPayerIdStr;

    if (isChangingPayer) {
      // Check if there are confirmed payments linked to this expense
      const hasConfirmedSplitSettlement = await Settlement.exists({
        tripId,
        idempotencyKey: { $regex: `^split_${expenseId}_` },
        status: 'PAID'
      });

      const hasParticipantPayments = expense.participants.some(p => {
        if (p.userId.toString() === oldPayerIdStr) return false;
        const pPaid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.status === 'PAID' ? Number(p.share || 0) : 0);
        return pPaid > 0;
      });

      if (hasConfirmedSplitSettlement || hasParticipantPayments) {
        return res.status(400).json({
          error: 'Cannot change the payer of an expense that already has confirmed split payments. Payments were already received by the original payer. Settle balances directly or adjust amounts without changing the payer.'
        });
      }
    }

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
          paidAmount: p.paidAmount,
          status: p.status
        }));
      } else {
        // Merge existing paidAmount and status if participants array is supplied
        const existingParticipantMap = new Map<string, any>();
        expense.participants.forEach(p => {
          existingParticipantMap.set(p.userId.toString(), p);
        });
        targetParticipants = targetParticipants.map((tp: any) => {
          const uIdStr = (tp.userId?._id || tp.userId).toString();
          const existing = existingParticipantMap.get(uIdStr);
          return {
            ...tp,
            userId: uIdStr,
            paidAmount: tp.paidAmount !== undefined
              ? tp.paidAmount
              : (existing ? (existing.paidAmount !== undefined ? existing.paidAmount : (existing.status === 'PAID' ? existing.share : 0)) : 0),
            status: tp.status || (existing ? existing.status : undefined)
          };
        });
      }

      try {
        expense.participants = calculateShares(
          expense.amount,
          expense.splitType,
          targetParticipants,
          expense.paidBy.toString(),
          oldPayerIdStr
        ) as any;
      } catch (validationErr: any) {
        return res.status(400).json({ error: validationErr.message || 'Invalid expense split distribution' });
      }
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
    const providedIdempotencyKey = req.body.idempotencyKey;

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

    // Server-side idempotency check:
    // If the client provided an idempotency key and that settlement already exists,
    // return the existing processed state immediately without creating a duplicate payment.
    if (providedIdempotencyKey) {
      const existingSettlement = await Settlement.findOne({
        tripId,
        idempotencyKey: providedIdempotencyKey
      });
      if (existingSettlement) {
        const populated = await Expense.findById(expense._id)
          .populate('paidBy', 'name avatar email')
          .populate('participants.userId', 'name avatar email');
        return res.status(200).json({
          expense: populated,
          settlement: existingSettlement,
          deduplicated: true,
          message: 'Payment already processed'
        });
      }
    }

    const currentPaid = participant.paidAmount !== undefined
      ? Number(participant.paidAmount)
      : (participant.status === 'PAID' ? Number(participant.share) : 0);
    const remainingToPay = Math.max(0, Math.round((Number(participant.share) - currentPaid) * 100) / 100);

    // Prevent duplicate payment for already paid split
    if (remainingToPay <= 0 || participant.status === 'PAID') {
      const populated = await Expense.findById(expense._id)
        .populate('paidBy', 'name avatar email')
        .populate('participants.userId', 'name avatar email');
      return res.json({ expense: populated, message: 'Split already paid' });
    }

    // Determine payment amount (allows partial payment if specified in req.body.amount)
    const requestedAmount = req.body.amount !== undefined ? Number(req.body.amount) : remainingToPay;
    if (requestedAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' });
    }
    const payAmount = Math.min(requestedAmount, remainingToPay);

    const newPaidTotal = Math.round((currentPaid + payAmount) * 100) / 100;
    const payerIdStr = expense.paidBy.toString();
    const targetIdStr = targetUserId.toString();
    const entropy = Math.random().toString(36).substring(2, 10);
    const splitKey = providedIdempotencyKey || `split_${expense._id}_${targetIdStr}_${Math.round(payAmount * 100)}_${Date.now()}_${entropy}`;

    let settlementRecord: any = null;

    // Detect if active MongoDB connection supports multi-document transactions (Replica Set / Sharded like MongoDB Atlas)
    const clientTopology = (mongoose.connection as any)?.client?.topology?.description?.type;
    const isReplicaSet = clientTopology === 'ReplicaSetWithPrimary' || clientTopology === 'Sharded';

    if (isReplicaSet) {
      // Transaction path: ACID multi-document atomicity on MongoDB Atlas
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          if (providedIdempotencyKey) {
            const existingInTx = await Settlement.findOne({ tripId, idempotencyKey: providedIdempotencyKey }).session(session);
            if (existingInTx) {
              settlementRecord = existingInTx;
              return;
            }
          }

          if (payerIdStr !== targetIdStr && payAmount > 0) {
            const createdArr = await Settlement.create(
              [{
                tripId,
                fromUser: targetUserId,
                toUser: expense.paidBy,
                amount: payAmount,
                status: 'PAID',
                paidAt: new Date(),
                notes: `Split payment for "${expense.title}"`,
                idempotencyKey: splitKey
              }],
              { session }
            );
            settlementRecord = createdArr[0];
          }

          participant.paidAmount = newPaidTotal;
          participant.status = newPaidTotal >= participant.share ? 'PAID' : 'PARTIAL';
          await expense.save({ session });
        });
      } catch (err: any) {
        if (err.code === 11000) {
          const populated = await Expense.findById(expense._id)
            .populate('paidBy', 'name avatar email')
            .populate('participants.userId', 'name avatar email');
          const existingSettlement = providedIdempotencyKey
            ? await Settlement.findOne({ tripId, idempotencyKey: providedIdempotencyKey })
            : null;
          return res.status(200).json({
            expense: populated,
            settlement: existingSettlement,
            deduplicated: true,
            message: 'Payment already processed'
          });
        }
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      // Standalone MongoDB fallback: create Settlement first, then save Expense.
      // If Expense save fails, compensate by deleting the created Settlement.
      if (payerIdStr !== targetIdStr && payAmount > 0) {
        try {
          settlementRecord = await Settlement.create({
            tripId,
            fromUser: targetUserId,
            toUser: expense.paidBy,
            amount: payAmount,
            status: 'PAID',
            paidAt: new Date(),
            notes: `Split payment for "${expense.title}"`,
            idempotencyKey: splitKey
          });
        } catch (err: any) {
          if (err.code === 11000) {
            const populated = await Expense.findById(expense._id)
              .populate('paidBy', 'name avatar email')
              .populate('participants.userId', 'name avatar email');
            const existingSettlement = providedIdempotencyKey
              ? await Settlement.findOne({ tripId, idempotencyKey: providedIdempotencyKey })
              : null;
            return res.status(200).json({
              expense: populated,
              settlement: existingSettlement,
              deduplicated: true,
              message: 'Payment already processed'
            });
          }
          throw err;
        }
      }

      try {
        participant.paidAmount = newPaidTotal;
        participant.status = newPaidTotal >= participant.share ? 'PAID' : 'PARTIAL';
        await expense.save();
      } catch (expenseSaveErr: any) {
        // Compensating rollback: delete settlement to maintain consistency
        if (settlementRecord && settlementRecord._id) {
          await Settlement.deleteOne({ _id: settlementRecord._id });
        }
        throw expenseSaveErr;
      }
    }

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name avatar email')
      .populate('participants.userId', 'name avatar email');

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

    // Never delete expenses with confirmed payments (whether through direct split payments or synchronized Settlements-tab payments)
    const confirmedSplitPayments = await Settlement.find({
      tripId,
      idempotencyKey: { $regex: `^split_${expenseId}_` },
      status: 'PAID'
    });
    const directPaidSum = confirmedSplitPayments.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    const payerIdStr = expense.paidBy.toString();
    const participantPaidSum = expense.participants.reduce((sum, p) => {
      if (p.userId.toString() === payerIdStr) return sum;
      const pPaid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.status === 'PAID' ? Number(p.share || 0) : 0);
      return sum + Math.max(0, pPaid);
    }, 0);

    const totalConfirmedPaid = Math.max(directPaidSum, participantPaidSum);

    if (totalConfirmedPaid > 0) {
      return res.status(400).json({
        error: `Cannot delete expense with confirmed split payment(s) totaling ₹${totalConfirmedPaid.toLocaleString('en-IN')}. Confirmed real-world payments must be preserved in the audit trail. To adjust obligations, edit the expense amount or settle balances directly.`
      });
    }

    if (expense.receiptPublicId) {
      await deleteFromCloudinary(expense.receiptPublicId, 'image');
      await deleteFromCloudinary(expense.receiptPublicId, 'raw');
    }

    const title = expense.title;
    await Expense.findByIdAndDelete(expenseId);

    // Clean up any non-paid (draft/pending) settlement records linked to this expense's splits
    await Settlement.deleteMany({
      tripId,
      idempotencyKey: { $regex: `^split_${expenseId}_` },
      status: { $ne: 'PAID' }
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
