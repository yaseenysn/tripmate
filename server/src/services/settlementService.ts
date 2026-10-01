import mongoose from 'mongoose';
import { Expense, Settlement, TripMember, User } from '../models';

export interface MemberBalance {
  userId: string;
  name: string;
  avatar?: string;
  totalPaid: number;
  totalShare: number;
  netBalance: number;
}

export interface SuggestedSettlement {
  fromUser: { _id: string; name: string; avatar?: string };
  toUser: { _id: string; name: string; avatar?: string };
  amount: number;
}

export const calculateTripBalancesAndSettlements = async (tripId: string) => {
  const tripObjectId = new mongoose.Types.ObjectId(tripId);

  // 1. Get all members
  const members = await TripMember.find({ tripId: tripObjectId }).populate('userId', 'name email avatar');
  const userMap: Record<string, { name: string; avatar?: string }> = {};

  const balances: Record<string, { totalPaid: number; totalShare: number }> = {};

  members.forEach(m => {
    const u = m.userId as any;
    if (u && u._id) {
      const uIdStr = u._id.toString();
      userMap[uIdStr] = { name: u.name, avatar: u.avatar };
      balances[uIdStr] = { totalPaid: 0, totalShare: 0 };
    }
  });

  // 2. Get all expenses
  const expenses = await Expense.find({ tripId: tripObjectId });

  expenses.forEach(exp => {
    const payerId = exp.paidBy.toString();
    if (!balances[payerId]) {
      balances[payerId] = { totalPaid: 0, totalShare: 0 };
    }
    balances[payerId].totalPaid += exp.amount;

    exp.participants.forEach(p => {
      const participantId = p.userId.toString();
      if (!balances[participantId]) {
        balances[participantId] = { totalPaid: 0, totalShare: 0 };
      }
      balances[participantId].totalShare += p.share;
    });
  });

  // 3. Construct MemberBalances array
  const memberBalances: MemberBalance[] = Object.keys(balances).map(uId => {
    const userInfo = userMap[uId] || { name: 'Unknown User', avatar: '' };
    const totalPaid = Math.round(balances[uId].totalPaid * 100) / 100;
    const totalShare = Math.round(balances[uId].totalShare * 100) / 100;
    const netBalance = Math.round((totalPaid - totalShare) * 100) / 100;

    return {
      userId: uId,
      name: userInfo.name,
      avatar: userInfo.avatar,
      totalPaid,
      totalShare,
      netBalance
    };
  });

  // 4. Calculate minimal debt settlement transfers
  const debtors: { userId: string; net: number }[] = [];
  const creditors: { userId: string; net: number }[] = [];

  memberBalances.forEach(m => {
    if (m.netBalance < -0.01) {
      debtors.push({ userId: m.userId, net: Math.abs(m.netBalance) });
    } else if (m.netBalance > 0.01) {
      creditors.push({ userId: m.userId, net: m.netBalance });
    }
  });

  debtors.sort((a, b) => b.net - a.net);
  creditors.sort((a, b) => b.net - a.net);

  const suggestedSettlements: SuggestedSettlement[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.net, creditor.net);

    if (amount > 0.01) {
      const roundedAmount = Math.round(amount * 100) / 100;
      const debtorInfo = userMap[debtor.userId] || { name: 'Unknown User' };
      const creditorInfo = userMap[creditor.userId] || { name: 'Unknown User' };

      suggestedSettlements.push({
        fromUser: { _id: debtor.userId, name: debtorInfo.name, avatar: debtorInfo.avatar },
        toUser: { _id: creditor.userId, name: creditorInfo.name, avatar: creditorInfo.avatar },
        amount: roundedAmount
      });

      debtor.net -= amount;
      creditor.net -= amount;
    }

    if (debtor.net <= 0.01) i++;
    if (creditor.net <= 0.01) j++;
  }

  return { memberBalances, suggestedSettlements };
};
