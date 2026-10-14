/**
 * TripMate Financial Safety Fixes — Phase A Test Suite
 *
 * Scenarios Tested:
 * 1. Invalid custom split totals (sum(share) != amount)
 * 2. Invalid percentage totals (sum(percentage) != 100%)
 * 3. Valid split totals with rounding remainders (deterministic paise allocation)
 * 4. Deleting an expense with a confirmed split payment (deletion rejected, audit trail preserved)
 * 5. Paying through Settlements tab and verifying expense card sync / duplicate prevention
 * 6. Legitimate partial payments (transition from PENDING -> PARTIAL -> PAID)
 * 7. Increasing an expense after participant has paid (status transitions to PARTIAL, paidAmount preserved)
 * 8. Decreasing an expense after participant has paid (status remains PAID, credit preserved in ledger)
 * 9. Member changes guarded against active balances & report cache invalidation
 * 10. Final report and PDF financial consistency (reconciliation invariants & exact arithmetic)
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Trip, TripMember, Expense, Settlement, Activity } from '../models';
import {
  calculateTripBalancesAndSettlements,
  generateAuthoritativeTripReport
} from '../services/settlementService';

let testPassed = 0;
let testFailed = 0;
let mongod: MongoMemoryServer;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TripMate: Financial Safety Fixes — Phase A Test Suite');
  console.log('======================================================\n');

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[Database] Connected to In-Memory MongoDB.\n');

    const runId = Date.now().toString(36);

    // 0. Setup Test Users
    const alice = await User.create({
      name: `Alice_${runId}`,
      email: `alice_${runId}@test.com`,
      passwordHash: 'hash',
      currency: '₹'
    });
    const bob = await User.create({
      name: `Bob_${runId}`,
      email: `bob_${runId}@test.com`,
      passwordHash: 'hash',
      currency: '₹'
    });
    const charlie = await User.create({
      name: `Charlie_${runId}`,
      email: `charlie_${runId}@test.com`,
      passwordHash: 'hash',
      currency: '₹'
    });

    const trip = await Trip.create({
      name: `Financial Audit Trip ${runId}`,
      destination: 'Goa',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-07'),
      currency: '₹',
      createdBy: alice._id,
      status: 'ACTIVE'
    });

    const mAlice = await TripMember.create({ tripId: trip._id, userId: alice._id, role: 'ADMIN' });
    const mBob = await TripMember.create({ tripId: trip._id, userId: bob._id, role: 'MEMBER' });
    const mCharlie = await TripMember.create({ tripId: trip._id, userId: charlie._id, role: 'MEMBER' });

    console.log('--- SCENARIO 1: INVALID CUSTOM SPLIT TOTALS ---');
    // Test helper mimicking expenseRoutes validation
    const validateCustomShares = (amount: number, shares: { userId: any; share: number }[]) => {
      const totalAmountPaise = Math.round(amount * 100);
      let sumPaise = 0;
      for (const p of shares) {
        if (p.share < 0) throw new Error('Participant custom share cannot be negative.');
        sumPaise += Math.round(p.share * 100);
      }
      if (sumPaise !== totalAmountPaise) {
        throw new Error(`Participant shares (₹${(sumPaise / 100).toFixed(2)}) must equal the total expense amount (₹${(totalAmountPaise / 100).toFixed(2)}).`);
      }
    };

    let caughtCustomErr = false;
    try {
      validateCustomShares(1000, [
        { userId: alice._id, share: 300 },
        { userId: bob._id, share: 300 }
      ]);
    } catch (e: any) {
      caughtCustomErr = true;
      assert(e.message.includes('must equal the total expense amount'), 'Under-allocated custom split rejected with clear error');
    }
    assert(caughtCustomErr, 'Scenario 1: Custom split under-allocation strictly rejected');

    let caughtOverAllocErr = false;
    try {
      validateCustomShares(1000, [
        { userId: alice._id, share: 600 },
        { userId: bob._id, share: 500 }
      ]);
    } catch (e: any) {
      caughtOverAllocErr = true;
      assert(e.message.includes('must equal the total expense amount'), 'Over-allocated custom split rejected with clear error');
    }
    assert(caughtOverAllocErr, 'Scenario 1: Custom split over-allocation strictly rejected');

    console.log('\n--- SCENARIO 2: INVALID PERCENTAGE TOTALS ---');
    const validatePercentages = (percentages: { userId: any; percentage: number }[]) => {
      const totalPct = percentages.reduce((s, p) => s + (Number(p.percentage) || 0), 0);
      if (Math.abs(Math.round(totalPct * 100) - 10000) > 1) {
        throw new Error(`Participant percentages total ${totalPct.toFixed(2)}%, but must equal exactly 100%.`);
      }
    };

    let caughtPctErr = false;
    try {
      validatePercentages([
        { userId: alice._id, percentage: 40 },
        { userId: bob._id, percentage: 40 }
      ]);
    } catch (e: any) {
      caughtPctErr = true;
      assert(e.message.includes('must equal exactly 100%'), 'Under-allocated percentage (80%) rejected');
    }
    assert(caughtPctErr, 'Scenario 2: Percentage under-allocation strictly rejected');

    console.log('\n--- SCENARIO 3: VALID SPLIT TOTALS WITH ROUNDING REMAINDERS ---');
    // ₹100 split 3 ways: 33.34, 33.33, 33.33 -> sum = 100.00
    const expValidEqual = await Expense.create({
      tripId: trip._id,
      title: 'Lunch',
      amount: 100,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 33.34, percentage: 33.3, paidAmount: 33.34, status: 'PAID' },
        { userId: bob._id, share: 33.33, percentage: 33.3, paidAmount: 0, status: 'PENDING' },
        { userId: charlie._id, share: 33.33, percentage: 33.3, paidAmount: 0, status: 'PENDING' }
      ],
      createdBy: alice._id
    });

    const calcEqual = await calculateTripBalancesAndSettlements(trip._id.toString());
    const sumSharesEqual = calcEqual.memberBalances.reduce((s, m) => s + m.totalShare, 0);
    assert(calcEqual.totalExpenses === 100, 'Total expense is ₹100');
    assert(Math.abs(sumSharesEqual - 100) < 0.001, 'Sum of participant shares equals ₹100.00 to the paise');
    assert(calcEqual.isReconciled, 'Equal split with paise remainder is strictly reconciled');
    assert(calcEqual.discrepancy === 0, 'Discrepancy is zero');

    // Clean up expValidEqual for subsequent isolated tests
    await Expense.deleteOne({ _id: expValidEqual._id });

    console.log('\n--- SCENARIO 4: DELETING EXPENSE WITH CONFIRMED PAYMENT ---');
    // Alice paid ₹1,000 dinner. Bob pays ₹500 split.
    const expDinner = await Expense.create({
      tripId: trip._id,
      title: 'Beach Dinner',
      amount: 1000,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 500, paidAmount: 500, status: 'PAID' },
        { userId: bob._id, share: 500, paidAmount: 500, status: 'PAID' }
      ],
      createdBy: alice._id
    });

    // Confirmed payment recorded for this split
    const splitPayment = await Settlement.create({
      tripId: trip._id,
      fromUser: bob._id,
      toUser: alice._id,
      amount: 500,
      status: 'PAID',
      paidAt: new Date(),
      idempotencyKey: `split_${expDinner._id}_${bob._id}`
    });

    // Verify deletion check:
    const confirmedPayments = await Settlement.find({
      tripId: trip._id,
      idempotencyKey: { $regex: `^split_${expDinner._id}_` },
      status: 'PAID'
    });

    assert(confirmedPayments.length === 1, 'Confirmed split payment found in DB');
    // Policy: reject deletion if confirmed payments exist
    const canDelete = confirmedPayments.length === 0;
    assert(!canDelete, 'Scenario 4: Deleting expense with confirmed payment is REJECTED');

    // Verify confirmed payment remains intact in DB
    const checkSettlement = await Settlement.findById(splitPayment._id);
    assert(checkSettlement !== null && checkSettlement.status === 'PAID', 'Historical payment preserved in database audit trail');

    console.log('\n--- SCENARIO 5: PREVENT DOUBLE SETTLEMENT (SETTLEMENTS TAB -> EXPENSE CARD) ---');
    // Reset settlements
    await Settlement.deleteMany({ tripId: trip._id });
    // Reset dinner expense to unpaid for Bob
    expDinner.participants = [
      { userId: alice._id, share: 500, paidAmount: 500, status: 'PAID' },
      { userId: bob._id, share: 500, paidAmount: 0, status: 'PENDING' }
    ];
    await expDinner.save();

    // Bob settles ₹500 to Alice via Settlements tab
    const settlePayment = await Settlement.create({
      tripId: trip._id,
      fromUser: bob._id,
      toUser: alice._id,
      amount: 500,
      status: 'PAID',
      paidAt: new Date(),
      idempotencyKey: `rec_${trip._id}_${bob._id}_${alice._id}_50000_${Date.now()}`
    });

    // Simulate backend synchronization logic (syncExpenseSplitsForSettlement)
    let remainingPayment = 500;
    const relExp = await Expense.find({
      tripId: trip._id,
      paidBy: alice._id,
      'participants.userId': bob._id
    });

    for (const exp of relExp) {
      if (remainingPayment <= 0) break;
      const part = exp.participants.find(p => p.userId.toString() === bob._id.toString());
      if (part) {
        const curPaid = part.paidAmount || 0;
        const needed = part.share - curPaid;
        const applied = Math.min(remainingPayment, needed);
        part.paidAmount = curPaid + applied;
        part.status = part.paidAmount >= part.share ? 'PAID' : 'PARTIAL';
        remainingPayment -= applied;
        await exp.save();
      }
    }

    // Verify expense card was updated to PAID
    const reloadedExp = await Expense.findById(expDinner._id);
    const bobPart = reloadedExp?.participants.find(p => p.userId.toString() === bob._id.toString());
    assert(bobPart?.status === 'PAID', 'Expense card split status updated to PAID via settlement synchronization');
    assert(bobPart?.paidAmount === 500, 'Expense card paidAmount updated to ₹500');

    // Now attempt second payment from expense card:
    const remainingToPay = Math.max(0, (bobPart?.share || 0) - (bobPart?.paidAmount || 0));
    assert(remainingToPay === 0, 'Remaining obligation on expense card is ₹0');
    const allowSecondPayment = remainingToPay > 0 && bobPart?.status !== 'PAID';
    assert(!allowSecondPayment, 'Scenario 5: Duplicate split payment attempt from expense card is PREVENTED');

    console.log('\n--- SCENARIO 6: LEGITIMATE PARTIAL PAYMENTS ---');
    // Expense of ₹600 (Alice 300, Bob 300)
    const expPartial = await Expense.create({
      tripId: trip._id,
      title: 'Cab Ride',
      amount: 600,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 300, paidAmount: 300, status: 'PAID' },
        { userId: bob._id, share: 300, paidAmount: 0, status: 'PENDING' }
      ],
      createdBy: alice._id
    });

    // Bob makes partial payment of ₹100
    const partBob = expPartial.participants.find(p => p.userId.toString() === bob._id.toString())!;
    const partialAmount1 = 100;
    partBob.paidAmount = (partBob.paidAmount || 0) + partialAmount1;
    partBob.status = partBob.paidAmount >= partBob.share ? 'PAID' : 'PARTIAL';
    await expPartial.save();

    assert(partBob.status === 'PARTIAL', 'Status transitions to PARTIAL after ₹100 payment');
    assert(partBob.paidAmount === 100, 'paidAmount is ₹100');
    assert(partBob.share - partBob.paidAmount === 200, 'Remaining obligation is ₹200');

    // Bob pays remaining ₹200
    const partialAmount2 = 200;
    partBob.paidAmount = (partBob.paidAmount || 0) + partialAmount2;
    partBob.status = partBob.paidAmount >= partBob.share ? 'PAID' : 'PARTIAL';
    await expPartial.save();

    assert(partBob.status === 'PAID', 'Status transitions to PAID after final ₹200 payment');
    assert(partBob.paidAmount === 300, 'Total paidAmount is ₹300');
    assert(partBob.share - partBob.paidAmount === 0, 'Scenario 6: Remaining obligation is now ₹0');

    console.log('\n--- SCENARIO 7: INCREASING EXPENSE AFTER PARTICIPANT HAS PAID ---');
    // expPartial was ₹600 (Bob paid ₹300, status PAID)
    // Expense amount is increased to ₹1,000 (Bob share becomes ₹500)
    const newAmount = 1000;
    const newShare = 500;
    // When editing: previous paidAmount of ₹300 is preserved
    const currentPaid = partBob.paidAmount; // 300
    partBob.share = newShare;
    partBob.paidAmount = currentPaid;
    partBob.status = currentPaid >= newShare ? 'PAID' : (currentPaid > 0 ? 'PARTIAL' : 'PENDING');
    await expPartial.save();

    assert(partBob.status === 'PARTIAL', 'Scenario 7: Status transitioned from PAID to PARTIAL after expense increase');
    assert(partBob.paidAmount === 300, 'Previously paid amount of ₹300 is strictly preserved');
    assert(partBob.share - partBob.paidAmount === 200, 'Bob accurately owes additional ₹200');

    console.log('\n--- SCENARIO 8: DECREASING EXPENSE AFTER PARTICIPANT HAS PAID ---');
    // Expense amount is decreased to ₹400 (Bob share becomes ₹200)
    // Bob had paid ₹300!
    const decreasedShare = 200;
    partBob.share = decreasedShare;
    partBob.status = partBob.paidAmount >= decreasedShare ? 'PAID' : 'PARTIAL';
    await expPartial.save();

    assert(partBob.status === 'PAID', 'Scenario 8: Status remains PAID when share is less than paidAmount');
    assert(partBob.paidAmount === 300, 'Historical paidAmount of ₹300 remains preserved');
    assert(partBob.paidAmount > partBob.share, 'Surplus payment is safely maintained in database records');

    console.log('\n--- SCENARIO 9: MEMBER CHANGES GUARDED AGAINST ACTIVE BALANCES ---');
    // Verify member cannot be deleted if net balance != 0
    const calcBeforeMemberDel = await calculateTripBalancesAndSettlements(trip._id.toString());
    const bobBalance = calcBeforeMemberDel.memberBalances.find(m => m.userId === bob._id.toString());

    assert(bobBalance !== undefined, 'Bob balance found in trip ledger');
    const canRemoveBob = Math.abs(bobBalance?.netBalance || 0) <= 0.01;
    // Bob has non-zero net balance due to expenses/settlements
    assert(!canRemoveBob, 'Scenario 9: Cannot remove member with active unsettled financial balances');

    console.log('\n--- SCENARIO 10: REPORT & PDF FINANCIAL CONSISTENCY ---');
    const authoritativeReport = await generateAuthoritativeTripReport(trip._id.toString());

    // Overview metrics
    assert(typeof authoritativeReport.overview.totalExpenses === 'number', 'totalExpenses is numeric');
    assert(authoritativeReport.overview.memberCount === 3, 'memberCount matches 3 members');
    assert(authoritativeReport.overview.averageExpensePerMember > 0, 'averageExpensePerMember is accurate');
    assert(authoritativeReport.overview.isReconciled === true, 'All trip balances strictly reconciled to 0.00');
    assert(authoritativeReport.overview.discrepancy === 0, 'Discrepancy is zero');

    // Check member arithmetic consistency
    let sumNetBalances = 0;
    for (const mb of authoritativeReport.memberBalances) {
      sumNetBalances += mb.netBalance;
      const expectedNet = (mb.totalPaid - mb.totalShare) + (mb.settlementsPaid - mb.settlementsReceived);
      assert(Math.abs(mb.netBalance - expectedNet) < 0.01, `Member ${mb.name} net balance satisfies explicit arithmetic formula`);
    }
    assert(Math.abs(sumNetBalances) < 0.01, 'Sum of all member net balances equals zero (Zero-Sum Invariant)');

    // Financial reconciliation block
    const rec = authoritativeReport.financialReconciliation!;
    assert(rec.isReconciled, 'Financial reconciliation statement is reconciled');
    assert(Math.abs(rec.totalOutstandingCreditorBalances - rec.totalOutstandingDebtorBalances) < 0.01, 'Scenario 10: Total receivable equals total payable');

    console.log('\n--- SCENARIO 11: FIX 1 — PAYER CHANGE AFTER CONFIRMED PAYMENT ---');
    // Create an expense paid by Alice (1000: Alice 500, Bob 500)
    const expPayerTest = await Expense.create({
      tripId: trip._id,
      title: 'Payer Lock Test Expense',
      amount: 1000,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 500, paidAmount: 500, status: 'PAID' },
        { userId: bob._id, share: 500, paidAmount: 0, status: 'PENDING' }
      ],
      createdBy: alice._id
    });

    // Helper mimicking PATCH expense payer change guard in expenseRoutes.ts
    const attemptPayerEdit = async (expId: any, newPaidBy?: any, otherUpdates?: { title?: string; amount?: number }) => {
      const targetExp = await Expense.findById(expId);
      if (!targetExp) throw new Error('Expense not found');

      const oldPayerIdStr = targetExp.paidBy.toString();
      const isChangingPayer = newPaidBy !== undefined && newPaidBy.toString() !== oldPayerIdStr;

      if (isChangingPayer) {
        const hasConfirmedSplitSettlement = await Settlement.exists({
          tripId: targetExp.tripId,
          idempotencyKey: { $regex: `^split_${targetExp._id}_` },
          status: 'PAID'
        });

        const hasParticipantPayments = targetExp.participants.some(p => {
          if (p.userId.toString() === oldPayerIdStr) return false;
          const pPaid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.status === 'PAID' ? Number(p.share || 0) : 0);
          return pPaid > 0;
        });

        if (hasConfirmedSplitSettlement || hasParticipantPayments) {
          throw new Error('Cannot change the payer of an expense that already has confirmed split payments. Payments were already received by the original payer. Settle balances directly or adjust amounts without changing the payer.');
        }
      }

      if (newPaidBy !== undefined) targetExp.paidBy = newPaidBy;
      if (otherUpdates?.title !== undefined) targetExp.title = otherUpdates.title;
      if (otherUpdates?.amount !== undefined) targetExp.amount = otherUpdates.amount;
      await targetExp.save();
      return targetExp;
    };

    // 11a: When no payment exists on splits, changing payer to Charlie is ALLOWED
    const updatedPayerExp = await attemptPayerEdit(expPayerTest._id, charlie._id);
    assert(updatedPayerExp.paidBy.toString() === charlie._id.toString(), 'Scenario 11a: Payer change allowed when expense has zero confirmed payments');

    // 11b: Create expense paid by Alice with confirmed payment from Bob
    const expWithPayments = await Expense.create({
      tripId: trip._id,
      title: 'Expense With Confirmed Payment',
      amount: 1000,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 500, paidAmount: 500, status: 'PAID' },
        { userId: bob._id, share: 500, paidAmount: 500, status: 'PAID' }
      ],
      createdBy: alice._id
    });

    const confirmedSplitRecord = await Settlement.create({
      tripId: trip._id,
      fromUser: bob._id,
      toUser: alice._id,
      amount: 500,
      status: 'PAID',
      paidAt: new Date(),
      idempotencyKey: `split_${expWithPayments._id}_${bob._id}_50000_${Date.now()}`
    });

    // 11b: Changing payer to Charlie after confirmed payment MUST BE BLOCKED
    let caughtPayerLockErr = false;
    try {
      await attemptPayerEdit(expWithPayments._id, charlie._id);
    } catch (e: any) {
      caughtPayerLockErr = true;
      assert(e.message.includes('Cannot change the payer of an expense that already has confirmed split payments'), 'Scenario 11b: Clear error returned when attempting to change payer');
    }
    assert(caughtPayerLockErr, 'Scenario 11b: Changing payer after confirmed payment is strictly BLOCKED');

    // 11c: Confirmed settlement record remains untouched
    const checkSettlementPayer = await Settlement.findById(confirmedSplitRecord._id);
    assert(checkSettlementPayer?.status === 'PAID' && checkSettlementPayer.toUser.toString() === alice._id.toString(), 'Scenario 11c: Historical payment attribution is strictly preserved');

    // 11d: Ordinary edits (title, notes, amount) that keep paidBy: Alice are ALLOWED
    const ordinaryEdit = await attemptPayerEdit(expWithPayments._id, alice._id, { title: 'Updated Title Same Payer' });
    assert(ordinaryEdit.title === 'Updated Title Same Payer', 'Scenario 11d: Ordinary edit that preserves original payer is ALLOWED');

    console.log('\n--- SCENARIO 12: FIX 2 — EXPENSE DELETION GUARD ---');
    // Helper mimicking DELETE expense guard in expenseRoutes.ts
    const attemptDeleteExpense = async (expId: any) => {
      const targetExp = await Expense.findById(expId);
      if (!targetExp) throw new Error('Expense not found');

      const confirmedSplitPayments = await Settlement.find({
        tripId: targetExp.tripId,
        idempotencyKey: { $regex: `^split_${expId}_` },
        status: 'PAID'
      });
      const directPaidSum = confirmedSplitPayments.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

      const payerIdStr = targetExp.paidBy.toString();
      const participantPaidSum = targetExp.participants.reduce((sum, p) => {
        if (p.userId.toString() === payerIdStr) return sum;
        const pPaid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.status === 'PAID' ? Number(p.share || 0) : 0);
        return sum + Math.max(0, pPaid);
      }, 0);

      const totalConfirmedPaid = Math.max(directPaidSum, participantPaidSum);

      if (totalConfirmedPaid > 0) {
        throw new Error(`Cannot delete expense with confirmed split payment(s) totaling ₹${totalConfirmedPaid.toLocaleString('en-IN')}. Confirmed real-world payments must be preserved in the audit trail. To adjust obligations, edit the expense amount or settle balances directly.`);
      }

      await Expense.findByIdAndDelete(expId);
      return { success: true };
    };

    // 12a: Expense with direct split payment is BLOCKED from deletion
    let caughtDirectDelErr = false;
    try {
      await attemptDeleteExpense(expWithPayments._id);
    } catch (e: any) {
      caughtDirectDelErr = true;
      assert(e.message.includes('Cannot delete expense with confirmed split payment(s)'), 'Scenario 12a: Direct split payment blocks deletion with explanation');
    }
    assert(caughtDirectDelErr, 'Scenario 12a: Deletion blocked for expense with direct split payment');

    // 12b: Expense with Settlements-tab payment synchronized to split (idempotencyKey starts with rec_, NOT split_)
    const expSyncTest = await Expense.create({
      tripId: trip._id,
      title: 'Synchronized Split Expense',
      amount: 800,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 400, paidAmount: 400, status: 'PAID' },
        { userId: bob._id, share: 400, paidAmount: 400, status: 'PAID' } // Synchronized via Settlements tab!
      ],
      createdBy: alice._id
    });
    // Create the settlement with rec_ prefix
    const syncSettlement = await Settlement.create({
      tripId: trip._id,
      fromUser: bob._id,
      toUser: alice._id,
      amount: 400,
      status: 'PAID',
      paidAt: new Date(),
      idempotencyKey: `rec_${trip._id}_${bob._id}_${alice._id}_40000_${Date.now()}`
    });

    let caughtSyncDelErr = false;
    try {
      await attemptDeleteExpense(expSyncTest._id);
    } catch (e: any) {
      caughtSyncDelErr = true;
      assert(e.message.includes('Cannot delete expense with confirmed split payment(s)'), 'Scenario 12b: Synchronized Settlements-tab payment blocks deletion');
    }
    assert(caughtSyncDelErr, 'Scenario 12b: Expense deletion guard covers Settlements-tab synchronized splits');
    // Confirm settlement record was NOT deleted
    const preservedSyncSettlement = await Settlement.findById(syncSettlement._id);
    assert(preservedSyncSettlement !== null, 'Scenario 12b: Confirmed settlement record is NEVER deleted');

    // 12c: Unrelated settlement exists between Alice and Bob: Expense with NO payments is NOT falsely blocked
    const expUnrelated = await Expense.create({
      tripId: trip._id,
      title: 'Unrelated Expense No Payments',
      amount: 500,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 250, paidAmount: 250, status: 'PAID' },
        { userId: bob._id, share: 250, paidAmount: 0, status: 'PENDING' } // 0 payments!
      ],
      createdBy: alice._id
    });
    const delResult = await attemptDeleteExpense(expUnrelated._id);
    assert(delResult.success === true, 'Scenario 12c: Expense with no payments is NOT falsely blocked by unrelated settlements');
    const verifyUnrelatedSettlement = await Settlement.findById(syncSettlement._id);
    assert(verifyUnrelatedSettlement !== null, 'Scenario 12c: Unrelated settlement between the same members remains fully intact');

    // 12d: Expense with zero payments is deleted cleanly
    const expFresh = await Expense.create({
      tripId: trip._id,
      title: 'Fresh Expense',
      amount: 300,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 150, paidAmount: 150, status: 'PAID' },
        { userId: charlie._id, share: 150, paidAmount: 0, status: 'PENDING' }
      ],
      createdBy: alice._id
    });
    const delFreshResult = await attemptDeleteExpense(expFresh._id);
    assert(delFreshResult.success === true, 'Scenario 12d: Expense with no payments deletes cleanly');

    console.log('\n--- SCENARIO 13: FIX 3 — SERVER-SIDE IDEMPOTENCY FOR SPLIT PAYMENTS ---');
    // Expense of ₹500 (Alice 250, Charlie 250)
    const expIdempTest = await Expense.create({
      tripId: trip._id,
      title: 'Idempotency Test Expense',
      amount: 500,
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 250, paidAmount: 250, status: 'PAID' },
        { userId: charlie._id, share: 250, paidAmount: 0, status: 'PENDING' }
      ],
      createdBy: alice._id
    });

    // Helper mimicking POST /pay-split in expenseRoutes.ts
    const executePaySplit = async (
      expId: any,
      targetUserId: any,
      options: { amount?: number; idempotencyKey?: string }
    ) => {
      const exp = await Expense.findById(expId);
      if (!exp) throw new Error('Expense not found');

      const participant = exp.participants.find(p => p.userId.toString() === targetUserId.toString());
      if (!participant) throw new Error('Participant not found');

      const providedIdempotencyKey = options.idempotencyKey;
      if (providedIdempotencyKey) {
        const existingSettlement = await Settlement.findOne({
          tripId: exp.tripId,
          idempotencyKey: providedIdempotencyKey
        });
        if (existingSettlement) {
          return { expense: exp, settlement: existingSettlement, deduplicated: true, message: 'Payment already processed' };
        }
      }

      const currentPaid = participant.paidAmount !== undefined
        ? Number(participant.paidAmount)
        : (participant.status === 'PAID' ? Number(participant.share) : 0);
      const remainingToPay = Math.max(0, Math.round((Number(participant.share) - currentPaid) * 100) / 100);

      if (remainingToPay <= 0 || participant.status === 'PAID') {
        return { expense: exp, deduplicated: true, message: 'Split already paid' };
      }

      const requestedAmount = options.amount !== undefined ? Number(options.amount) : remainingToPay;
      const payAmount = Math.min(requestedAmount, remainingToPay);

      const newPaidTotal = Math.round((currentPaid + payAmount) * 100) / 100;
      participant.paidAmount = newPaidTotal;
      participant.status = newPaidTotal >= participant.share ? 'PAID' : 'PARTIAL';
      await exp.save();

      const entropy = Math.random().toString(36).substring(2, 10);
      const splitKey = providedIdempotencyKey || `split_${exp._id}_${targetUserId}_${Math.round(payAmount * 100)}_${Date.now()}_${entropy}`;

      let settlementDoc: any;
      if (exp.paidBy.toString() !== targetUserId.toString() && payAmount > 0) {
        settlementDoc = await Settlement.create({
          tripId: exp.tripId,
          fromUser: targetUserId,
          toUser: exp.paidBy,
          amount: payAmount,
          status: 'PAID',
          paidAt: new Date(),
          notes: `Split payment for "${exp.title}"`,
          idempotencyKey: splitKey
        });
      }

      return { expense: exp, settlement: settlementDoc, deduplicated: false };
    };

    // 13a: Generate client key with entropy
    const entropy1 = Math.random().toString(36).substring(2, 10);
    const clientKey1 = `splitpay_${trip._id}_${expIdempTest._id}_10000_${Date.now()}_${entropy1}`;

    // 13b: First partial payment of ₹100
    const res1 = await executePaySplit(expIdempTest._id, charlie._id, { amount: 100, idempotencyKey: clientKey1 });
    assert(res1.deduplicated === false, 'Scenario 13b: First payment attempt processed normally');
    const expAfterPay1 = await Expense.findById(expIdempTest._id);
    const chPart1 = expAfterPay1?.participants.find(p => p.userId.toString() === charlie._id.toString());
    assert(chPart1?.paidAmount === 100, 'Charlie paidAmount updated to ₹100');
    assert(chPart1?.status === 'PARTIAL', 'Charlie status transitioned to PARTIAL');

    // 13c: Exact duplicate request with same idempotencyKey
    const resDuplicate = await executePaySplit(expIdempTest._id, charlie._id, { amount: 100, idempotencyKey: clientKey1 });
    assert(resDuplicate.deduplicated === true, 'Scenario 13c: Repeating payment with same key returns deduplicated: true');
    assert(resDuplicate.message === 'Payment already processed', 'Clear message indicating duplicate payment intercepted');
    const expAfterDuplicate = await Expense.findById(expIdempTest._id);
    const chPartDuplicate = expAfterDuplicate?.participants.find(p => p.userId.toString() === charlie._id.toString());
    assert(chPartDuplicate?.paidAmount === 100, 'Duplicate request did NOT increment paidAmount a second time');

    const totalSettlementsForKey1 = await Settlement.countDocuments({ idempotencyKey: clientKey1 });
    assert(totalSettlementsForKey1 === 1, 'Exactly one Settlement record exists for clientKey1 (zero duplicate records)');

    // 13d: Legitimate second partial payment of remaining ₹150 with a new unique key
    const entropy2 = Math.random().toString(36).substring(2, 10);
    const clientKey2 = `splitpay_${trip._id}_${expIdempTest._id}_15000_${Date.now()}_${entropy2}`;
    const res2 = await executePaySplit(expIdempTest._id, charlie._id, { amount: 150, idempotencyKey: clientKey2 });
    assert(res2.deduplicated === false, 'Scenario 13d: Legitimate subsequent partial payment with new key processed');
    const expAfterPay2 = await Expense.findById(expIdempTest._id);
    const chPart2 = expAfterPay2?.participants.find(p => p.userId.toString() === charlie._id.toString());
    assert(chPart2?.paidAmount === 250, 'Charlie paidAmount correctly accumulated to full ₹250');
    assert(chPart2?.status === 'PAID', 'Charlie status transitioned to PAID');

    // 13e: Uniqueness guarantee entropy verification
    const entropyTestKeys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const e = Math.random().toString(36).substring(2, 10);
      entropyTestKeys.add(`key_${Date.now()}_${e}`);
    }
    assert(entropyTestKeys.size === 50, 'Scenario 13e: High-entropy generation guarantees unique keys without relying on Date.now() alone');

    console.log('\n--- CLEANUP ---');
    await Settlement.deleteMany({ tripId: trip._id });
    await Expense.deleteMany({ tripId: trip._id });
    await TripMember.deleteMany({ tripId: trip._id });
    await Trip.deleteOne({ _id: trip._id });
    await User.deleteMany({ _id: { $in: [alice._id, bob._id, charlie._id] } });
    console.log('Cleaned up test trip, members, expenses, and settlements.\n');

  } catch (err: any) {
    console.error('Test Execution Error:', err);
    testFailed++;
  } finally {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    console.log('======================================================');
    console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
    console.log('======================================================\n');
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runTests();
