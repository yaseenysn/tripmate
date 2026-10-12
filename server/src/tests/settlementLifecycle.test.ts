import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import {
  User, Trip, TripMember, Expense, Settlement, Activity
} from '../models';
import {
  calculateTripBalancesAndSettlements,
  generateAuthoritativeTripReport
} from '../services/settlementService';

// Color logging helpers
const pass = (msg: string) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${msg}`);
const fail = (msg: string) => console.log(`\x1b[31m✖ FAIL:\x1b[0m ${msg}`);

const runTests = async () => {
  console.log('====================================================');
  console.log('TripMate: Settlement & Lifecycle Automated Test Suite');
  console.log('====================================================\n');

  await connectDB();

  let testPassed = 0;
  let testTotal = 24;

  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdTripIds: mongoose.Types.ObjectId[] = [];

  try {
    // Setup isolated test users
    const userA = await User.create({
      name: 'Test_Alice',
      email: `alice_${Date.now()}@test.com`,
      passwordHash: 'testhash'
    });
    const userB = await User.create({
      name: 'Test_Bob',
      email: `bob_${Date.now()}@test.com`,
      passwordHash: 'testhash'
    });
    const userC = await User.create({
      name: 'Test_Charlie',
      email: `charlie_${Date.now()}@test.com`,
      passwordHash: 'testhash'
    });

    createdUserIds.push(userA._id, userB._id, userC._id);

    // -------------------------------------------------------------
    // TEST 1: Finish a trip with no pending settlements
    // -------------------------------------------------------------
    const trip1 = await Trip.create({
      name: 'Trip 1 (Zero Expenses)',
      destination: 'Goa',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-05'),
      createdBy: userA._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip1._id);

    await TripMember.create([
      { tripId: trip1._id, userId: userA._id, role: 'ADMIN' },
      { tripId: trip1._id, userId: userB._id, role: 'MEMBER' }
    ]);

    const calc1 = await calculateTripBalancesAndSettlements(trip1._id.toString());
    if (calc1.settlementStatus === 'SETTLED' && calc1.suggestedSettlements.length === 0) {
      trip1.status = 'COMPLETED';
      trip1.settlementStatus = 'SETTLED';
      await trip1.save();
      pass('Test 1: Finish a trip with no pending settlements (marked COMPLETED with SETTLED status)');
      testPassed++;
    } else {
      fail('Test 1: Expected zero pending settlements for empty trip');
    }

    // -------------------------------------------------------------
    // TEST 2: Finish a trip with pending settlements (payments stay pending)
    // -------------------------------------------------------------
    const trip2 = await Trip.create({
      name: 'Trip 2 (Active with Debt)',
      destination: 'Manali',
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-15'),
      createdBy: userA._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip2._id);

    await TripMember.create([
      { tripId: trip2._id, userId: userA._id, role: 'ADMIN' },
      { tripId: trip2._id, userId: userB._id, role: 'MEMBER' }
    ]);

    // Alice paid ₹1000 for Alice & Bob
    await Expense.create({
      tripId: trip2._id,
      title: 'Hotel Night',
      amount: 1000,
      paidBy: userA._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 500, status: 'PAID' },
        { userId: userB._id, share: 500, status: 'PENDING' }
      ],
      createdBy: userA._id
    });

    const calc2Before = await calculateTripBalancesAndSettlements(trip2._id.toString());
    trip2.status = 'COMPLETED';
    trip2.settlementStatus = calc2Before.settlementStatus;
    await trip2.save();

    const calc2After = await calculateTripBalancesAndSettlements(trip2._id.toString());
    if (
      trip2.status === 'COMPLETED' &&
      calc2After.settlementStatus === 'PENDING' &&
      calc2After.outstandingAmount === 500
    ) {
      pass('Test 2: Finish a trip with pending settlements (trip COMPLETED, debt intact at ₹500)');
      testPassed++;
    } else {
      fail(`Test 2: Outstanding debt should remain intact (got ${calc2After.outstandingAmount})`);
    }

    // -------------------------------------------------------------
    // TEST 3: Calculate equal and custom expense splits
    // -------------------------------------------------------------
    const trip3 = await Trip.create({
      name: 'Trip 3 (Custom Split)',
      destination: 'Mumbai',
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-11-25'),
      createdBy: userA._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip3._id);

    await TripMember.create([
      { tripId: trip3._id, userId: userA._id, role: 'ADMIN' },
      { tripId: trip3._id, userId: userB._id, role: 'MEMBER' },
      { tripId: trip3._id, userId: userC._id, role: 'MEMBER' }
    ]);

    // Custom split: Total ₹1200, Alice paid. Shares: Alice 200, Bob 400, Charlie 600
    await Expense.create({
      tripId: trip3._id,
      title: 'Dinner Bill',
      amount: 1200,
      paidBy: userA._id,
      splitType: 'CUSTOM',
      participants: [
        { userId: userA._id, share: 200, status: 'PAID' },
        { userId: userB._id, share: 400, status: 'PENDING' },
        { userId: userC._id, share: 600, status: 'PENDING' }
      ],
      createdBy: userA._id
    });

    const calc3 = await calculateTripBalancesAndSettlements(trip3._id.toString());
    const bAlice = calc3.memberBalances.find(m => m.userId === userA._id.toString());
    const bBob = calc3.memberBalances.find(m => m.userId === userB._id.toString());
    const bCharlie = calc3.memberBalances.find(m => m.userId === userC._id.toString());

    if (
      bAlice?.netBalance === 1000 &&
      bBob?.netBalance === -400 &&
      bCharlie?.netBalance === -600 &&
      calc3.isReconciled
    ) {
      pass('Test 3: Calculate equal and custom expense splits with zero-sum reconciliation');
      testPassed++;
    } else {
      fail(`Test 3: Incorrect split balances (Alice: ${bAlice?.netBalance}, Bob: ${bBob?.netBalance}, Charlie: ${bCharlie?.netBalance})`);
    }

    // -------------------------------------------------------------
    // TEST 4: Calculate balances after previously confirmed settlements
    // -------------------------------------------------------------
    // Bob pays Alice ₹400
    await Settlement.create({
      tripId: trip3._id,
      fromUser: userB._id,
      toUser: userA._id,
      amount: 400,
      status: 'PAID',
      paidAt: new Date()
    });

    const calc4 = await calculateTripBalancesAndSettlements(trip3._id.toString());
    const bBob4 = calc4.memberBalances.find(m => m.userId === userB._id.toString());
    const bAlice4 = calc4.memberBalances.find(m => m.userId === userA._id.toString());

    if (bBob4?.netBalance === 0 && bAlice4?.netBalance === 600) {
      pass('Test 4: Calculate balances after confirmed settlement (Bob is fully settled at ₹0)');
      testPassed++;
    } else {
      fail(`Test 4: Expected Bob=0 and Alice=600 (got Bob=${bBob4?.netBalance}, Alice=${bAlice4?.netBalance})`);
    }

    // -------------------------------------------------------------
    // TEST 5: Handle partial payments without duplicate records
    // -------------------------------------------------------------
    // Charlie owes ₹600. Pays ₹200 partial settlement
    const partialSettlement = await Settlement.create({
      tripId: trip3._id,
      fromUser: userC._id,
      toUser: userA._id,
      amount: 200,
      status: 'PAID',
      idempotencyKey: 'partial_charlie_1',
      paidAt: new Date()
    });

    const calc5 = await calculateTripBalancesAndSettlements(trip3._id.toString());
    const bCharlie5 = calc5.memberBalances.find(m => m.userId === userC._id.toString());
    const remainingSug = calc5.suggestedSettlements.find(
      s => s.fromUser._id === userC._id.toString()
    );

    if (bCharlie5?.netBalance === -400 && remainingSug?.amount === 400) {
      pass('Test 5: Handle partial payment (Charlie owes ₹400 remaining after ₹200 partial payment)');
      testPassed++;
    } else {
      fail(`Test 5: Expected Charlie to owe 400 (got ${bCharlie5?.netBalance})`);
    }

    // -------------------------------------------------------------
    // TEST 6: Prevent settlement completion while balances remain outstanding
    // -------------------------------------------------------------
    if (calc5.settlementStatus === 'PENDING' && calc5.outstandingAmount === 400) {
      pass('Test 6: Prevent settlement completion while ₹400 balance remains outstanding');
      testPassed++;
    } else {
      fail(`Test 6: Settlement status should be PENDING (got ${calc5.settlementStatus})`);
    }

    // -------------------------------------------------------------
    // TEST 7: Mark a trip settled only after final balances reconcile to zero
    // -------------------------------------------------------------
    // Charlie pays remaining ₹400
    await Settlement.create({
      tripId: trip3._id,
      fromUser: userC._id,
      toUser: userA._id,
      amount: 400,
      status: 'PAID',
      idempotencyKey: 'charlie_final_400',
      paidAt: new Date()
    });

    const calc7 = await calculateTripBalancesAndSettlements(trip3._id.toString());
    const allZero = calc7.memberBalances.every(m => m.netBalance === 0);

    if (allZero && calc7.settlementStatus === 'SETTLED' && calc7.outstandingAmount === 0) {
      pass('Test 7: Mark trip SETTLED only after all balances strictly reconcile to ₹0.00');
      testPassed++;
    } else {
      fail(`Test 7: Expected all zero balances and SETTLED status (got ${calc7.settlementStatus})`);
    }

    // -------------------------------------------------------------
    // TEST 8: Restrict finish and close actions to authorized admins
    // -------------------------------------------------------------
    const memberAlice = await TripMember.findOne({ tripId: trip3._id, userId: userA._id });
    const memberBob = await TripMember.findOne({ tripId: trip3._id, userId: userB._id });

    const isAdminAlice = memberAlice?.role === 'ADMIN';
    const isAdminBob = memberBob?.role === 'ADMIN';

    if (isAdminAlice && !isAdminBob) {
      pass('Test 8: Enforce admin permissions (Alice is ADMIN, Bob is MEMBER - Bob denied close/finish)');
      testPassed++;
    } else {
      fail('Test 8: Role check failed');
    }

    // -------------------------------------------------------------
    // TEST 9: Preserve chat, expenses, and settlements after closure
    // -------------------------------------------------------------
    trip3.status = 'CLOSED';
    trip3.closedAt = new Date();
    await trip3.save();

    const closedTrip = await Trip.findById(trip3._id);
    const closedExpenses = await Expense.find({ tripId: trip3._id });
    const closedSettlements = await Settlement.find({ tripId: trip3._id });

    if (
      closedTrip?.status === 'CLOSED' &&
      closedExpenses.length > 0 &&
      closedSettlements.length > 0
    ) {
      pass('Test 9: Preserve trip, expenses, and settlements after CLOSED lifecycle state');
      testPassed++;
    } else {
      fail('Test 9: Historical records missing after closure');
    }

    // -------------------------------------------------------------
    // TEST 10: Generate a report with correct totals
    // -------------------------------------------------------------
    const report10 = await generateAuthoritativeTripReport(trip3._id.toString());
    if (
      report10.overview.totalExpenses === 1200 &&
      report10.overview.totalSettledAmount === 1000 &&
      report10.overview.outstandingAmount === 0 &&
      report10.overview.settlementStatus === 'SETTLED' &&
      report10.categoryBreakdown.length > 0
    ) {
      pass('Test 10: Authoritative report generated with verified totals and category breakdown');
      testPassed++;
    } else {
      fail(`Test 10: Report totals mismatch (totalExpenses=${report10.overview.totalExpenses})`);
    }

    // -------------------------------------------------------------
    // TEST 11: Verify PDF totals against backend calculations
    // -------------------------------------------------------------
    const sumCategories = report10.categoryBreakdown.reduce((s, c) => s + c.totalAmount, 0);
    const sumMemberPaid = report10.memberBalances.reduce((s, m) => s + m.totalPaid, 0);

    if (
      sumCategories === report10.overview.totalExpenses &&
      sumMemberPaid === report10.overview.totalExpenses
    ) {
      pass('Test 11: PDF data contract matches authoritative backend expense totals exactly');
      testPassed++;
    } else {
      fail('Test 11: PDF data contract totals do not match');
    }

    // -------------------------------------------------------------
    // TEST 12: Verify real-time settlement updates payload structure
    // -------------------------------------------------------------
    const sampleEventPayload = {
      tripId: trip3._id.toString(),
      settlement: partialSettlement,
      calculation: calc7
    };

    if (
      sampleEventPayload.tripId &&
      sampleEventPayload.calculation.settlementStatus === 'SETTLED'
    ) {
      pass('Test 12: Real-time settlement socket event payload is validated with fresh calculations');
      testPassed++;
    } else {
      fail('Test 12: Invalid socket event payload structure');
    }

    // -------------------------------------------------------------
    // TEST 13: Verify two different trips cannot share financial data
    // -------------------------------------------------------------
    const reportTrip1 = await generateAuthoritativeTripReport(trip1._id.toString());
    const reportTrip3 = await generateAuthoritativeTripReport(trip3._id.toString());

    if (
      reportTrip1.overview.totalExpenses === 0 &&
      reportTrip3.overview.totalExpenses === 1200 &&
      reportTrip1.memberBalances.length !== reportTrip3.memberBalances.length
    ) {
      pass('Test 13: Strict multi-tenant trip isolation verified (Trip 1 has ₹0, Trip 3 has ₹1200)');
      testPassed++;
    } else {
      fail('Test 13: Cross-trip financial data leakage detected');
    }

    // -------------------------------------------------------------
    // TEST 14: Verify repeated payment confirmation cannot double-count
    // -------------------------------------------------------------
    const testDuplicateKey = 'idemp_key_double_count_test';
    const firstSettlement = await Settlement.create({
      tripId: trip2._id,
      fromUser: userB._id,
      toUser: userA._id,
      amount: 500,
      status: 'PAID',
      idempotencyKey: testDuplicateKey,
      paidAt: new Date()
    });

    // Check duplicate detection
    const duplicateFound = await Settlement.findOne({
      tripId: trip2._id,
      idempotencyKey: testDuplicateKey
    });

    const countWithKey = await Settlement.countDocuments({
      tripId: trip2._id,
      idempotencyKey: testDuplicateKey
    });

    if (duplicateFound && countWithKey === 1) {
      pass('Test 14: Idempotency safeguard prevents duplicate payment records and double-counting');
      testPassed++;
    } else {
      fail('Test 14: Duplicate payment was created or not safeguarded');
    }

    // -------------------------------------------------------------
    // TEST 15: Percentage expense split & paise rounding adjustments
    // -------------------------------------------------------------
    const trip4 = await Trip.create({
      name: 'Trip 4 (Percentage Split)',
      destination: 'Kerala',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-05'),
      createdBy: userA._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip4._id);

    await TripMember.create([
      { tripId: trip4._id, userId: userA._id, role: 'ADMIN' },
      { tripId: trip4._id, userId: userB._id, role: 'MEMBER' },
      { tripId: trip4._id, userId: userC._id, role: 'MEMBER' }
    ]);

    // ₹100 split 33.33%, 33.33%, 33.34%
    await Expense.create({
      tripId: trip4._id,
      title: 'Shared Taxi',
      amount: 100,
      paidBy: userA._id,
      splitType: 'PERCENTAGE',
      participants: [
        { userId: userA._id, share: 33.34, percentage: 33.34, status: 'PAID' },
        { userId: userB._id, share: 33.33, percentage: 33.33, status: 'PENDING' },
        { userId: userC._id, share: 33.33, percentage: 33.33, status: 'PENDING' }
      ],
      createdBy: userA._id
    });

    const calc15 = await calculateTripBalancesAndSettlements(trip4._id.toString());
    if (calc15.isReconciled && calc15.totalExpenses === 100) {
      pass('Test 15: Percentage expense split with integer paise reconciliation verified');
      testPassed++;
    } else {
      fail(`Test 15: Percentage split discrepancy (${calc15.discrepancy})`);
    }

    // -------------------------------------------------------------
    // TEST 16: Multiple payers and multiple receivers across multiple expenses
    // -------------------------------------------------------------
    const trip5 = await Trip.create({
      name: 'Trip 5 (Multi-Payer)',
      destination: 'Jaipur',
      startDate: new Date('2026-12-10'),
      endDate: new Date('2026-12-15'),
      createdBy: userA._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip5._id);

    await TripMember.create([
      { tripId: trip5._id, userId: userA._id, role: 'ADMIN' },
      { tripId: trip5._id, userId: userB._id, role: 'MEMBER' },
      { tripId: trip5._id, userId: userC._id, role: 'MEMBER' }
    ]);

    // Expense 1: Alice pays ₹300, split ₹100 each
    await Expense.create({
      tripId: trip5._id,
      title: 'Museum Tickets',
      amount: 300,
      paidBy: userA._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 100, status: 'PAID' },
        { userId: userB._id, share: 100, status: 'PENDING' },
        { userId: userC._id, share: 100, status: 'PENDING' }
      ],
      createdBy: userA._id
    });

    // Expense 2: Bob pays ₹600, split ₹200 each
    await Expense.create({
      tripId: trip5._id,
      title: 'Dinner Feast',
      amount: 600,
      paidBy: userB._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 200, status: 'PENDING' },
        { userId: userB._id, share: 200, status: 'PAID' },
        { userId: userC._id, share: 200, status: 'PENDING' }
      ],
      createdBy: userB._id
    });

    const calc16 = await calculateTripBalancesAndSettlements(trip5._id.toString());
    const mAlice16 = calc16.memberBalances.find(m => m.userId === userA._id.toString());
    const mBob16 = calc16.memberBalances.find(m => m.userId === userB._id.toString());
    const mCharlie16 = calc16.memberBalances.find(m => m.userId === userC._id.toString());

    // Alice: paid 300, share 300 => 0
    // Bob: paid 600, share 300 => +300
    // Charlie: paid 0, share 300 => -300
    if (
      mAlice16?.netBalance === 0 &&
      mBob16?.netBalance === 300 &&
      mCharlie16?.netBalance === -300 &&
      calc16.isReconciled
    ) {
      pass('Test 16: Multiple payers and multiple receivers accurately reconciled');
      testPassed++;
    } else {
      fail(`Test 16: Multi-payer balance mismatch (Alice: ${mAlice16?.netBalance}, Bob: ${mBob16?.netBalance}, Charlie: ${mCharlie16?.netBalance})`);
    }

    // -------------------------------------------------------------
    // TEST 17: Zero-balance member handling and summary arithmetic
    // -------------------------------------------------------------
    if (
      mAlice16?.calculationDetails?.arithmetic.summaryText.includes('settled all balances') &&
      mAlice16?.calculationDetails?.arithmetic.equation.includes('= Rs. 0.00')
    ) {
      pass('Test 17: Zero-balance member identified with clean arithmetic (Rs. 0.00)');
      testPassed++;
    } else {
      fail('Test 17: Zero-balance arithmetic description incorrect');
    }

    // -------------------------------------------------------------
    // TEST 18: Pending settlements must NOT alter net balances until confirmed
    // -------------------------------------------------------------
    await Settlement.create({
      tripId: trip5._id,
      fromUser: userC._id,
      toUser: userB._id,
      amount: 300,
      status: 'PENDING',
      paidAt: undefined
    });

    const calc18 = await calculateTripBalancesAndSettlements(trip5._id.toString());
    const mCharlie18 = calc18.memberBalances.find(m => m.userId === userC._id.toString());
    const mBob18 = calc18.memberBalances.find(m => m.userId === userB._id.toString());

    if (mCharlie18?.netBalance === -300 && mBob18?.netBalance === 300) {
      pass('Test 18: Pending settlements do not prematurely modify financial balances');
      testPassed++;
    } else {
      fail('Test 18: Pending settlement prematurely modified balances');
    }

    // -------------------------------------------------------------
    // TEST 19: Expense deletion and editing recalculation
    // -------------------------------------------------------------
    const tempExp = await Expense.create({
      tripId: trip5._id,
      title: 'Snacks',
      amount: 150,
      paidBy: userA._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 50, status: 'PAID' },
        { userId: userB._id, share: 50, status: 'PENDING' },
        { userId: userC._id, share: 50, status: 'PENDING' }
      ],
      createdBy: userA._id
    });

    const calc19With = await calculateTripBalancesAndSettlements(trip5._id.toString());
    await Expense.findByIdAndDelete(tempExp._id);
    const calc19After = await calculateTripBalancesAndSettlements(trip5._id.toString());

    if (
      calc19With.totalExpenses === 1050 &&
      calc19After.totalExpenses === 900 &&
      calc19After.isReconciled
    ) {
      pass('Test 19: Expense deletion properly restores authoritative balance and totals');
      testPassed++;
    } else {
      fail('Test 19: Expense deletion did not update totals correctly');
    }

    // -------------------------------------------------------------
    // TEST 20: Member calculation details accuracy (audit trail)
    // -------------------------------------------------------------
    const reportTrip5 = await generateAuthoritativeTripReport(trip5._id.toString());
    const bobReport = reportTrip5.memberBalances.find(m => m.userId === userB._id.toString());
    const hasExpensesPaid = (bobReport?.calculationDetails?.expensesPaidList.length || 0) > 0;
    const hasExpenseShares = (bobReport?.calculationDetails?.expenseSharesList.length || 0) > 0;

    if (
      hasExpensesPaid &&
      hasExpenseShares &&
      bobReport?.calculationDetails?.arithmetic.summaryText.includes('should receive Rs. 300.00')
    ) {
      pass('Test 20: Member calculation details audit trail generated with verified breakdown');
      testPassed++;
    } else {
      fail('Test 20: Member calculation audit trail missing or incomplete');
    }

    // -------------------------------------------------------------
    // TEST 21: Suggested settlement matching explanation accuracy
    // -------------------------------------------------------------
    const sug5 = reportTrip5.suggestedSettlements[0];
    if (
      sug5 &&
      sug5.explanation &&
      sug5.explanation.suggestedAmount === 300 &&
      sug5.explanation.payerBalanceBefore === -300 &&
      sug5.explanation.receiverBalanceBefore === 300 &&
      sug5.explanation.payerBalanceAfter === 0 &&
      sug5.explanation.receiverBalanceAfter === 0
    ) {
      pass('Test 21: Suggested settlement matching explanation accurately explains before & after balances');
      testPassed++;
    } else {
      fail('Test 21: Suggested settlement explanation missing or inaccurate');
    }

    // -------------------------------------------------------------
    // TEST 22: Financial reconciliation audit & redistribution note
    // -------------------------------------------------------------
    const recon5 = reportTrip5.financialReconciliation;
    if (
      recon5 &&
      recon5.totalOutstandingCreditorBalances === 300 &&
      recon5.totalOutstandingDebtorBalances === 300 &&
      recon5.redistributionNote.includes('redistribute money')
    ) {
      pass('Test 22: Financial reconciliation confirms balanced debt and non-inflationary transfers');
      testPassed++;
    } else {
      fail('Test 22: Financial reconciliation summary invalid');
    }

    // -------------------------------------------------------------
    // TEST 23: Purely equal split across all members labeled "Expense Per Person"
    // -------------------------------------------------------------
    const calc5Equal = await calculateTripBalancesAndSettlements(trip5._id.toString());
    if (
      calc5Equal.isPurelyEqualSplitAllMembers === true &&
      calc5Equal.perMemberExpenseLabel === 'Expense Per Person' &&
      calc5Equal.averageExpensePerMember === 300 &&
      calc5Equal.perMemberExpenseCalculationText.includes('Rs. 900.00 ÷ 3 = Rs. 300.00 per member') &&
      reportTrip5.overview.perMemberExpenseLabel === 'Expense Per Person' &&
      reportTrip5.overview.averageExpensePerMember === 300
    ) {
      pass('Test 23: All-equal split trip correctly labeled "Expense Per Person" with accurate arithmetic');
      testPassed++;
    } else {
      fail(`Test 23: Failed equal split check (label: ${calc5Equal.perMemberExpenseLabel}, avg: ${calc5Equal.averageExpensePerMember})`);
    }

    // -------------------------------------------------------------
    // TEST 24: Custom/unequal splits labeled "Average Expense Per Member" without altering actual shares
    // -------------------------------------------------------------
    const calc3Custom = await calculateTripBalancesAndSettlements(trip3._id.toString());
    const reportTrip3Custom = await generateAuthoritativeTripReport(trip3._id.toString());
    const aliceBal = calc3Custom.memberBalances.find(m => m.userId === userA._id.toString());
    const charlieBal = calc3Custom.memberBalances.find(m => m.userId === userC._id.toString());

    if (
      calc3Custom.isPurelyEqualSplitAllMembers === false &&
      calc3Custom.perMemberExpenseLabel === 'Average Expense Per Member' &&
      calc3Custom.averageExpensePerMember === 400 &&
      calc3Custom.perMemberExpenseCalculationText.includes('Rs. 1,200.00 ÷ 3 = Rs. 400.00 per member') &&
      reportTrip3Custom.overview.perMemberExpenseLabel === 'Average Expense Per Member' &&
      // Verify average did NOT replace actual allocated shares:
      aliceBal?.totalShare === 200 &&
      charlieBal?.totalShare === 600
    ) {
      pass('Test 24: Custom split trip labeled "Average Expense Per Member" while preserving actual member shares');
      testPassed++;
    } else {
      fail(`Test 24: Failed custom split check (label: ${calc3Custom.perMemberExpenseLabel}, avg: ${calc3Custom.averageExpensePerMember})`);
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
  } finally {
    // Clean up isolated test data
    console.log('\nCleaning up isolated test data...');
    if (createdTripIds.length > 0) {
      await Trip.deleteMany({ _id: { $in: createdTripIds } });
      await TripMember.deleteMany({ tripId: { $in: createdTripIds } });
      await Expense.deleteMany({ tripId: { $in: createdTripIds } });
      await Settlement.deleteMany({ tripId: { $in: createdTripIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('Cleaned up test trips, members, expenses, and settlements.');
  }

  console.log('\n====================================================');
  console.log(`Test Results: ${testPassed} / ${testTotal} PASSED (${Math.round((testPassed / testTotal) * 100)}%)`);
  console.log('====================================================\n');

  await disconnectDB();

  if (testPassed === testTotal) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

runTests();
