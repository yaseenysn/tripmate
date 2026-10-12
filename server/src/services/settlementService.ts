import mongoose from 'mongoose';
import { Expense, Settlement, TripMember, Trip, User } from '../models';

export interface MemberCalculationDetails {
  expensesPaidList: {
    expenseId: string;
    title: string;
    amount: number;
    category: string;
    date: Date;
    paidByName: string;
  }[];
  expenseSharesList: {
    expenseId: string;
    title: string;
    totalAmount: number;
    category: string;
    date: Date;
    splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE';
    participantCount: number;
    memberShare: number;
    percentage?: number;
    roundingAdjustment?: number;
    paidByName: string;
    explanation: string;
  }[];
  settlementsPaidList: {
    settlementId: string;
    toUserId: string;
    toUserName: string;
    amount: number;
    paidAt?: Date;
    status: string;
    notes?: string;
    reference?: string;
  }[];
  settlementsReceivedList: {
    settlementId: string;
    fromUserId: string;
    fromUserName: string;
    amount: number;
    paidAt?: Date;
    status: string;
    notes?: string;
    reference?: string;
  }[];
  arithmetic: {
    expensesPaid: number;
    expenseShare: number;
    settlementsPaid: number;
    settlementsReceived: number;
    netBalance: number;
    equation: string;
    summaryText: string;
  };
}

export interface MemberBalance {
  userId: string;
  name: string;
  avatar?: string;
  email?: string;
  role?: string;
  totalPaid: number;          // Eligible expenses paid
  totalShare: number;         // Allocated personal share
  settlementsPaid: number;    // Confirmed settlements paid
  settlementsReceived: number;// Confirmed settlements received
  netBalance: number;         // Final net balance (positive = owed to member, negative = owes)
  calculationDetails?: MemberCalculationDetails;
}

export interface SuggestedSettlementExplanation {
  payerBalanceBefore: number;
  receiverBalanceBefore: number;
  suggestedAmount: number;
  payerBalanceAfter: number;
  receiverBalanceAfter: number;
  matchReason: string;
  relatedPayments: {
    fromUserName: string;
    toUserName: string;
    amount: number;
    isCurrent: boolean;
  }[];
}

export interface SuggestedSettlement {
  settlementId?: string;
  fromUser: { _id: string; name: string; avatar?: string; email?: string };
  toUser: { _id: string; name: string; avatar?: string; email?: string };
  amount: number;
  status: 'PENDING' | 'PAID';
  amountPaid: number;
  remainingAmount: number;
  explanation?: SuggestedSettlementExplanation;
}

export interface DetailedExpenseSplit {
  _id: string;
  title: string;
  amount: number;
  category: string;
  date: Date;
  paidBy: { _id: string; name: string };
  splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE';
  participants: {
    userId: string;
    name: string;
    share: number;
    percentage?: number;
    status?: string;
  }[];
  allocatedTotal: number;
  roundingAdjustment: number;
  isReconciled: boolean;
  validationWarning?: string;
}

export interface FinancialReconciliation {
  totalExpenses: number;
  totalSettledAmount: number;
  totalOutstandingCreditorBalances: number;
  totalOutstandingDebtorBalances: number;
  remainingAmountToSettle: number;
  isReconciled: boolean;
  discrepancy: number;
  redistributionNote: string;
}

export interface SettlementCalculationResult {
  memberBalances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
  detailedExpenseSplits?: DetailedExpenseSplit[];
  financialReconciliation?: FinancialReconciliation;
  totalExpenses: number;
  totalSettledAmount: number;
  outstandingAmount: number;
  isReconciled: boolean;
  discrepancy: number;
  settlementStatus: 'SETTLED' | 'PENDING';
  averageExpensePerMember: number;
  isPurelyEqualSplitAllMembers: boolean;
  perMemberExpenseLabel: 'Expense Per Person' | 'Average Expense Per Member';
  perMemberExpenseCalculationText: string;
  perMemberExpenseExplanation: string;
}

const toPaise = (val: number): number => Math.round((Number(val) || 0) * 100);
const fromPaise = (paise: number): number => Math.round(paise) / 100;

export const calculateTripBalancesAndSettlements = async (
  tripId: string
): Promise<SettlementCalculationResult> => {
  const tripObjectId = new mongoose.Types.ObjectId(tripId);

  // 1. Fetch trip members
  const members = await TripMember.find({ tripId: tripObjectId }).populate(
    'userId',
    'name email avatar'
  );

  const userMap: Record<
    string,
    { name: string; avatar?: string; email?: string; role?: string }
  > = {};

  const balances: Record<
    string,
    {
      paisePaid: number;
      paiseShare: number;
      paiseSettlementsPaid: number;
      paiseSettlementsReceived: number;
    }
  > = {};

  const memberExpensesPaid: Record<
    string,
    Array<{
      expenseId: string;
      title: string;
      amount: number;
      category: string;
      date: Date;
      paidByName: string;
    }>
  > = {};

  const memberExpenseShares: Record<
    string,
    Array<{
      expenseId: string;
      title: string;
      totalAmount: number;
      category: string;
      date: Date;
      splitType: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE';
      participantCount: number;
      memberShare: number;
      percentage?: number;
      roundingAdjustment?: number;
      paidByName: string;
      explanation: string;
    }>
  > = {};

  const memberSettlementsPaid: Record<
    string,
    Array<{
      settlementId: string;
      toUserId: string;
      toUserName: string;
      amount: number;
      paidAt?: Date;
      status: string;
      notes?: string;
      reference?: string;
    }>
  > = {};

  const memberSettlementsReceived: Record<
    string,
    Array<{
      settlementId: string;
      fromUserId: string;
      fromUserName: string;
      amount: number;
      paidAt?: Date;
      status: string;
      notes?: string;
      reference?: string;
    }>
  > = {};

  members.forEach((m) => {
    const u = m.userId as any;
    if (u && u._id) {
      const uIdStr = u._id.toString();
      userMap[uIdStr] = {
        name: u.name,
        avatar: u.avatar,
        email: u.email,
        role: m.role
      };
      balances[uIdStr] = {
        paisePaid: 0,
        paiseShare: 0,
        paiseSettlementsPaid: 0,
        paiseSettlementsReceived: 0
      };
      memberExpensesPaid[uIdStr] = [];
      memberExpenseShares[uIdStr] = [];
      memberSettlementsPaid[uIdStr] = [];
      memberSettlementsReceived[uIdStr] = [];
    }
  });

  // 2. Fetch all expenses for the trip
  const expenses = await Expense.find({ tripId: tripObjectId }).sort({ date: 1 });
  let totalExpensesPaise = 0;
  const detailedExpenseSplits: DetailedExpenseSplit[] = [];

  expenses.forEach((exp) => {
    const expPaise = toPaise(exp.amount);
    totalExpensesPaise += expPaise;

    const payerId = exp.paidBy ? exp.paidBy.toString() : '';
    const payerName = userMap[payerId]?.name || 'Unknown User';

    if (payerId) {
      if (!balances[payerId]) {
        balances[payerId] = {
          paisePaid: 0,
          paiseShare: 0,
          paiseSettlementsPaid: 0,
          paiseSettlementsReceived: 0
        };
        memberExpensesPaid[payerId] = [];
        memberExpenseShares[payerId] = [];
        memberSettlementsPaid[payerId] = [];
        memberSettlementsReceived[payerId] = [];
      }
      balances[payerId].paisePaid += expPaise;

      memberExpensesPaid[payerId].push({
        expenseId: exp._id.toString(),
        title: exp.title,
        amount: fromPaise(expPaise),
        category: exp.category,
        date: exp.date,
        paidByName: payerName
      });
    }

    // Split shares allocated to participants
    const participants = exp.participants || [];
    let sumSharePaise = 0;

    participants.forEach((p) => {
      const participantId = p.userId ? p.userId.toString() : '';
      if (participantId) {
        if (!balances[participantId]) {
          balances[participantId] = {
            paisePaid: 0,
            paiseShare: 0,
            paiseSettlementsPaid: 0,
            paiseSettlementsReceived: 0
          };
          memberExpensesPaid[participantId] = [];
          memberExpenseShares[participantId] = [];
          memberSettlementsPaid[participantId] = [];
          memberSettlementsReceived[participantId] = [];
        }
        const pSharePaise = toPaise(p.share);
        balances[participantId].paiseShare += pSharePaise;
        sumSharePaise += pSharePaise;

        let explanation = '';
        if (exp.splitType === 'EQUAL') {
          const perPerson = fromPaise(Math.round(expPaise / Math.max(1, participants.length)));
          explanation = `Equal split between ${participants.length} members (~Rs. ${perPerson.toFixed(2)} each)`;
        } else if (exp.splitType === 'PERCENTAGE') {
          explanation = `Percentage share (${p.percentage || Math.round((pSharePaise / Math.max(1, expPaise)) * 100)}% of Rs. ${fromPaise(expPaise).toFixed(2)})`;
        } else {
          explanation = `Custom allocated amount of Rs. ${fromPaise(pSharePaise).toFixed(2)}`;
        }

        if (!memberExpenseShares[participantId]) {
          memberExpenseShares[participantId] = [];
        }
        memberExpenseShares[participantId].push({
          expenseId: exp._id.toString(),
          title: exp.title,
          totalAmount: fromPaise(expPaise),
          category: exp.category,
          date: exp.date,
          splitType: exp.splitType,
          participantCount: participants.length,
          memberShare: fromPaise(pSharePaise),
          percentage: p.percentage,
          roundingAdjustment: 0,
          paidByName: payerName,
          explanation
        });
      }
    });

    // Explicit rounding adjustment for equal/fractional split discrepancies
    const roundingDiff = expPaise - sumSharePaise;
    if (roundingDiff !== 0 && payerId && balances[payerId]) {
      // Adjust residual single paise on the payer's own allocated share
      balances[payerId].paiseShare += roundingDiff;
      const payerShareEntry = memberExpenseShares[payerId]?.find(
        (e) => e.expenseId === exp._id.toString()
      );
      if (payerShareEntry) {
        payerShareEntry.memberShare = fromPaise(
          toPaise(payerShareEntry.memberShare) + roundingDiff
        );
        payerShareEntry.roundingAdjustment = fromPaise(roundingDiff);
        payerShareEntry.explanation += ` (+Rs. ${fromPaise(roundingDiff).toFixed(2)} rounding adjustment)`;
      }
    }

    // Detailed expense split record for transparency audit
    const partDetails = participants.map((p) => {
      const pId = p.userId ? p.userId.toString() : '';
      return {
        userId: pId,
        name: userMap[pId]?.name || 'Unknown',
        share: p.share,
        percentage: p.percentage,
        status: p.status
      };
    });

    const allocatedPaise = sumSharePaise + (roundingDiff !== 0 ? roundingDiff : 0);
    const isReconciledExp = allocatedPaise === expPaise;

    detailedExpenseSplits.push({
      _id: exp._id.toString(),
      title: exp.title,
      amount: fromPaise(expPaise),
      category: exp.category,
      date: exp.date,
      paidBy: {
        _id: payerId,
        name: payerName
      },
      splitType: exp.splitType,
      participants: partDetails,
      allocatedTotal: fromPaise(allocatedPaise),
      roundingAdjustment: fromPaise(roundingDiff),
      isReconciled: isReconciledExp,
      validationWarning: isReconciledExp
        ? undefined
        : `Discrepancy: Participant shares total Rs. ${fromPaise(allocatedPaise).toFixed(2)} which does not match expense amount Rs. ${fromPaise(expPaise).toFixed(2)}.`
    });
  });

  // 3. Fetch confirmed settlements (status: 'PAID')
  const confirmedSettlements = await Settlement.find({
    tripId: tripObjectId,
    status: 'PAID'
  }).sort({ paidAt: 1, createdAt: 1 });

  let totalSettledPaise = 0;

  confirmedSettlements.forEach((s) => {
    const sAmountPaise = toPaise(s.amount);
    totalSettledPaise += sAmountPaise;

    const fromId = s.fromUser ? s.fromUser.toString() : '';
    const toId = s.toUser ? s.toUser.toString() : '';
    const fromName = userMap[fromId]?.name || 'Unknown User';
    const toName = userMap[toId]?.name || 'Unknown User';

    if (fromId) {
      if (!balances[fromId]) {
        balances[fromId] = {
          paisePaid: 0,
          paiseShare: 0,
          paiseSettlementsPaid: 0,
          paiseSettlementsReceived: 0
        };
        memberExpensesPaid[fromId] = [];
        memberExpenseShares[fromId] = [];
        memberSettlementsPaid[fromId] = [];
        memberSettlementsReceived[fromId] = [];
      }
      balances[fromId].paiseSettlementsPaid += sAmountPaise;

      memberSettlementsPaid[fromId].push({
        settlementId: s._id.toString(),
        toUserId: toId,
        toUserName: toName,
        amount: fromPaise(sAmountPaise),
        paidAt: s.paidAt || s.createdAt,
        status: s.status,
        notes: s.notes,
        reference: s.reference
      });
    }

    if (toId) {
      if (!balances[toId]) {
        balances[toId] = {
          paisePaid: 0,
          paiseShare: 0,
          paiseSettlementsPaid: 0,
          paiseSettlementsReceived: 0
        };
        memberExpensesPaid[toId] = [];
        memberExpenseShares[toId] = [];
        memberSettlementsPaid[toId] = [];
        memberSettlementsReceived[toId] = [];
      }
      balances[toId].paiseSettlementsReceived += sAmountPaise;

      memberSettlementsReceived[toId].push({
        settlementId: s._id.toString(),
        fromUserId: fromId,
        fromUserName: fromName,
        amount: fromPaise(sAmountPaise),
        paidAt: s.paidAt || s.createdAt,
        status: s.status,
        notes: s.notes,
        reference: s.reference
      });
    }
  });

  // 4. Calculate Net Balances and Form Explicit Arithmetic Details for each member
  // Net Balance = (Expenses Paid - Allocated Share) + (Settlements Paid - Settlements Received)
  const memberBalances: MemberBalance[] = Object.keys(balances).map((uId) => {
    const userInfo = userMap[uId] || { name: 'Unknown User' };
    const b = balances[uId];

    const netPaise =
      (b.paisePaid - b.paiseShare) +
      (b.paiseSettlementsPaid - b.paiseSettlementsReceived);

    const netBalance = fromPaise(netPaise);
    const expensesPaid = fromPaise(b.paisePaid);
    const expenseShare = fromPaise(b.paiseShare);
    const settlementsPaid = fromPaise(b.paiseSettlementsPaid);
    const settlementsReceived = fromPaise(b.paiseSettlementsReceived);

    const paidFormatted = `Rs. ${expensesPaid.toFixed(2)}`;
    const shareFormatted = `Rs. ${expenseShare.toFixed(2)}`;
    const settPaidFormatted = `Rs. ${settlementsPaid.toFixed(2)}`;
    const settRecvFormatted = `Rs. ${settlementsReceived.toFixed(2)}`;
    const netFormatted = `${netBalance >= 0 ? '' : '-'}Rs. ${Math.abs(netBalance).toFixed(2)}`;

    // Explicit arithmetic: Expenses Paid - Share + Settlements Paid - Settlements Received = Net Balance
    const equation = `${paidFormatted} - ${shareFormatted} + ${settPaidFormatted} - ${settRecvFormatted} = ${netFormatted}`;

    let summaryText = '';
    if (netBalance > 0.009) {
      summaryText = `This member should receive Rs. ${netBalance.toFixed(2)}.`;
    } else if (netBalance < -0.009) {
      summaryText = `This member needs to pay Rs. ${Math.abs(netBalance).toFixed(2)}.`;
    } else {
      summaryText = `This member has settled all balances (Rs. 0.00).`;
    }

    const calculationDetails: MemberCalculationDetails = {
      expensesPaidList: memberExpensesPaid[uId] || [],
      expenseSharesList: memberExpenseShares[uId] || [],
      settlementsPaidList: memberSettlementsPaid[uId] || [],
      settlementsReceivedList: memberSettlementsReceived[uId] || [],
      arithmetic: {
        expensesPaid,
        expenseShare,
        settlementsPaid,
        settlementsReceived,
        netBalance,
        equation,
        summaryText
      }
    };

    return {
      userId: uId,
      name: userInfo.name,
      avatar: userInfo.avatar,
      email: userInfo.email,
      role: userInfo.role,
      totalPaid: expensesPaid,
      totalShare: expenseShare,
      settlementsPaid,
      settlementsReceived,
      netBalance,
      calculationDetails
    };
  });

  // 5. Verification & Zero-Sum Reconciliation
  const sumNetPaise = memberBalances.reduce(
    (acc, m) => acc + toPaise(m.netBalance),
    0
  );
  const isReconciled = Math.abs(sumNetPaise) === 0;
  const discrepancy = fromPaise(sumNetPaise);

  // If there's an explicit 1-2 paise rounding residual across members, handle gracefully
  if (!isReconciled && Math.abs(sumNetPaise) <= memberBalances.length && memberBalances.length > 0) {
    const sorted = [...memberBalances].sort(
      (a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance)
    );
    if (sorted[0]) {
      const adjustedNet = fromPaise(toPaise(sorted[0].netBalance) - sumNetPaise);
      sorted[0].netBalance = adjustedNet;
      if (sorted[0].calculationDetails) {
        sorted[0].calculationDetails.arithmetic.netBalance = adjustedNet;
      }
    }
  }

  // 6. Calculate Minimal Debt Settlement Suggestions & Explanations
  const debtors: { userId: string; netPaise: number }[] = [];
  const creditors: { userId: string; netPaise: number }[] = [];

  memberBalances.forEach((m) => {
    const pNet = toPaise(m.netBalance);
    if (pNet < 0) {
      debtors.push({ userId: m.userId, netPaise: Math.abs(pNet) });
    } else if (pNet > 0) {
      creditors.push({ userId: m.userId, netPaise: pNet });
    }
  });

  debtors.sort((a, b) => b.netPaise - a.netPaise);
  creditors.sort((a, b) => b.netPaise - a.netPaise);

  // Check existing pending settlements recorded in DB
  const pendingSettlements = await Settlement.find({
    tripId: tripObjectId,
    status: 'PENDING'
  });

  const suggestedSettlements: SuggestedSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;
  let remainingOutstandingPaise = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const transferPaise = Math.min(debtor.netPaise, creditor.netPaise);

    if (transferPaise > 0) {
      const debtorInfo = userMap[debtor.userId] || { name: 'Unknown User' };
      const creditorInfo = userMap[creditor.userId] || { name: 'Unknown User' };
      const transferAmount = fromPaise(transferPaise);

      const payerBalanceBefore = fromPaise(-debtor.netPaise);
      const receiverBalanceBefore = fromPaise(creditor.netPaise);
      const payerBalanceAfter = fromPaise(-(debtor.netPaise - transferPaise));
      const receiverBalanceAfter = fromPaise(creditor.netPaise - transferPaise);

      const matchReason = `Matched using debt-minimization algorithm: ${debtorInfo.name} has remaining debt of Rs. ${fromPaise(debtor.netPaise).toFixed(2)} and ${creditorInfo.name} has remaining credit of Rs. ${fromPaise(creditor.netPaise).toFixed(2)}. This transfer settles Rs. ${transferAmount.toFixed(2)}.`;

      // Check if there's a matching pending settlement in DB
      const existingPending = pendingSettlements.find(
        (ps) =>
          ps.fromUser.toString() === debtor.userId &&
          ps.toUser.toString() === creditor.userId
      );

      suggestedSettlements.push({
        settlementId: existingPending?._id ? existingPending._id.toString() : undefined,
        fromUser: {
          _id: debtor.userId,
          name: debtorInfo.name,
          avatar: debtorInfo.avatar,
          email: debtorInfo.email
        },
        toUser: {
          _id: creditor.userId,
          name: creditorInfo.name,
          avatar: creditorInfo.avatar,
          email: creditorInfo.email
        },
        amount: transferAmount,
        status: 'PENDING',
        amountPaid: 0,
        remainingAmount: transferAmount,
        explanation: {
          payerBalanceBefore,
          receiverBalanceBefore,
          suggestedAmount: transferAmount,
          payerBalanceAfter,
          receiverBalanceAfter,
          matchReason,
          relatedPayments: []
        }
      });

      remainingOutstandingPaise += transferPaise;
      debtor.netPaise -= transferPaise;
      creditor.netPaise -= transferPaise;
    }

    if (debtor.netPaise <= 0) dIdx++;
    if (creditor.netPaise <= 0) cIdx++;
  }

  // Populate related proposed payments for each suggested settlement
  suggestedSettlements.forEach((s) => {
    if (s.explanation) {
      const related = suggestedSettlements
        .filter(
          (other) =>
            other.fromUser._id === s.fromUser._id ||
            other.toUser._id === s.fromUser._id ||
            other.fromUser._id === s.toUser._id ||
            other.toUser._id === s.toUser._id
        )
        .map((other) => ({
          fromUserName: other.fromUser.name,
          toUserName: other.toUser.name,
          amount: other.amount,
          isCurrent:
            other.fromUser._id === s.fromUser._id &&
            other.toUser._id === s.toUser._id &&
            other.amount === s.amount
        }));
      s.explanation.relatedPayments = related;
    }
  });

  // 7. Calculate Financial Reconciliation Totals
  const totalCreditorPaise = memberBalances
    .filter((m) => toPaise(m.netBalance) > 0)
    .reduce((acc, m) => acc + toPaise(m.netBalance), 0);

  const totalDebtorPaise = memberBalances
    .filter((m) => toPaise(m.netBalance) < 0)
    .reduce((acc, m) => acc + Math.abs(toPaise(m.netBalance)), 0);

  const financialReconciliation: FinancialReconciliation = {
    totalExpenses: fromPaise(totalExpensesPaise),
    totalSettledAmount: fromPaise(totalSettledPaise),
    totalOutstandingCreditorBalances: fromPaise(totalCreditorPaise),
    totalOutstandingDebtorBalances: fromPaise(totalDebtorPaise),
    remainingAmountToSettle: fromPaise(totalCreditorPaise),
    isReconciled,
    discrepancy,
    redistributionNote:
      'Settlement transfers redistribute money between members to reconcile balances; they do not create additional trip expenses.'
  };

  // 8. Determine Average / Equal Per-Member Expense Metrics
  const memberCount = memberBalances.length;
  let isPurelyEqualSplitAllMembers = memberCount > 0;

  if (expenses.length === 0) {
    isPurelyEqualSplitAllMembers = true;
  } else {
    for (const exp of expenses) {
      if (exp.splitType !== 'EQUAL') {
        isPurelyEqualSplitAllMembers = false;
        break;
      }
      const participants = exp.participants || [];
      if (participants.length !== memberCount) {
        isPurelyEqualSplitAllMembers = false;
        break;
      }
      const participantIds = new Set(participants.map((p) => p.userId?.toString()));
      for (const m of memberBalances) {
        if (!participantIds.has(m.userId)) {
          isPurelyEqualSplitAllMembers = false;
          break;
        }
      }
      if (!isPurelyEqualSplitAllMembers) break;
    }
  }

  const averageExpensePerMember =
    memberCount > 0
      ? fromPaise(Math.round(totalExpensesPaise / memberCount))
      : 0;

  const perMemberExpenseLabel: 'Expense Per Person' | 'Average Expense Per Member' =
    isPurelyEqualSplitAllMembers ? 'Expense Per Person' : 'Average Expense Per Member';

  const totalExpFormatted = `Rs. ${fromPaise(totalExpensesPaise).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  const avgExpFormatted = `Rs. ${averageExpensePerMember.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const perMemberExpenseCalculationText =
    memberCount > 0
      ? `${totalExpFormatted} ÷ ${memberCount} = ${avgExpFormatted} per member`
      : 'Rs. 0.00 ÷ 0 = Rs. 0.00 per member';

  const perMemberExpenseExplanation = isPurelyEqualSplitAllMembers
    ? `Every expense in this trip is equally shared among all ${memberCount} trip members (${perMemberExpenseCalculationText}). Each member's allocated share is exactly ${avgExpFormatted}.`
    : `This represents the statistical average per member (${perMemberExpenseCalculationText}). Because the trip contains custom splits, percentage splits, or expenses shared by only selected members, each member's actual expense share differs from this average.`;

  // Determine overall settlement status
  const allBalancesZero = memberBalances.every(
    (m) => Math.abs(toPaise(m.netBalance)) === 0
  );
  const settlementStatus: 'SETTLED' | 'PENDING' =
    allBalancesZero && suggestedSettlements.length === 0 ? 'SETTLED' : 'PENDING';

  return {
    memberBalances,
    suggestedSettlements,
    detailedExpenseSplits,
    financialReconciliation,
    totalExpenses: fromPaise(totalExpensesPaise),
    totalSettledAmount: fromPaise(totalSettledPaise),
    outstandingAmount: fromPaise(totalCreditorPaise),
    isReconciled,
    discrepancy,
    settlementStatus,
    averageExpensePerMember,
    isPurelyEqualSplitAllMembers,
    perMemberExpenseLabel,
    perMemberExpenseCalculationText,
    perMemberExpenseExplanation
  };
};

/**
 * Generates an authoritative, comprehensive trip report.
 */
export const generateAuthoritativeTripReport = async (tripId: string) => {
  const tripObjectId = new mongoose.Types.ObjectId(tripId);
  const trip = await Trip.findById(tripObjectId).populate('createdBy', 'name email');
  if (!trip) throw new Error('Trip not found');

  const {
    memberBalances,
    suggestedSettlements,
    detailedExpenseSplits,
    financialReconciliation,
    totalExpenses,
    totalSettledAmount,
    outstandingAmount,
    isReconciled,
    discrepancy,
    settlementStatus,
    averageExpensePerMember,
    isPurelyEqualSplitAllMembers,
    perMemberExpenseLabel,
    perMemberExpenseCalculationText,
    perMemberExpenseExplanation
  } = await calculateTripBalancesAndSettlements(tripId);

  // Category breakdown
  const expenses = await Expense.find({ tripId: tripObjectId }).sort({ date: 1 });
  const categoryMap: Record<string, { totalPaise: number; count: number }> = {};

  expenses.forEach((e) => {
    const cat = e.category || 'Miscellaneous';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { totalPaise: 0, count: 0 };
    }
    categoryMap[cat].totalPaise += toPaise(e.amount);
    categoryMap[cat].count += 1;
  });

  const categoryBreakdown = Object.keys(categoryMap).map((cat) => {
    const totalAmount = fromPaise(categoryMap[cat].totalPaise);
    const percentage =
      totalExpenses > 0
        ? Math.round((totalAmount / totalExpenses) * 1000) / 10
        : 0;
    return {
      category: cat,
      totalAmount,
      count: categoryMap[cat].count,
      percentage
    };
  });

  // Recorded settlements history
  const settlementHistory = await Settlement.find({ tripId: tripObjectId })
    .populate('fromUser', 'name avatar email')
    .populate('toUser', 'name avatar email')
    .sort({ createdAt: -1 });

  return {
    trip: {
      _id: trip._id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      currency: trip.currency || '₹',
      status: trip.status,
      settlementStatus: trip.settlementStatus || settlementStatus,
      estimatedBudget: trip.estimatedBudget || 0,
      createdBy: trip.createdBy,
      closedAt: trip.closedAt,
      completedAt: trip.completedAt
    },
    overview: {
      totalExpenses,
      totalSettledAmount,
      outstandingAmount,
      totalOutstandingCreditorBalances: financialReconciliation?.totalOutstandingCreditorBalances || outstandingAmount,
      totalOutstandingDebtorBalances: financialReconciliation?.totalOutstandingDebtorBalances || outstandingAmount,
      memberCount: memberBalances.length,
      averageExpensePerMember,
      isPurelyEqualSplitAllMembers,
      perMemberExpenseLabel,
      perMemberExpenseCalculationText,
      perMemberExpenseExplanation,
      settlementStatus,
      isReconciled,
      discrepancy,
      redistributionNote: financialReconciliation?.redistributionNote
    },
    categoryBreakdown,
    memberBalances,
    suggestedSettlements,
    detailedExpenseSplits,
    settlementHistory,
    financialReconciliation,
    generatedAt: new Date().toISOString()
  };
};
