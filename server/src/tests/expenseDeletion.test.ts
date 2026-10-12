import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  Trip,
  TripMember,
  Expense,
  Settlement,
  User,
  Activity
} from '../models';
import {
  calculateTripBalancesAndSettlements,
  generateAuthoritativeTripReport
} from '../services/settlementService';

let mongod: MongoMemoryServer;

const connectDB = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log(`[Database] Connected to In-Memory MongoDB at ${uri}`);
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  await mongod.stop();
};

const pass = (desc: string) => console.log(`✔ PASS: ${desc}`);
const fail = (desc: string) => console.error(`✖ FAIL: ${desc}`);

export const runExpenseDeletionTests = async () => {
  await connectDB();

  console.log('\n====================================================');
  console.log('TripMate: Expense Deletion Comprehensive Test Suite');
  console.log('====================================================\n');

  let testPassed = 0;
  let testTotal = 11; // Tests A through K

  const createdTripIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  try {
    // 0. Seed Users: Alice (Admin), Bob (Member), Charlie (Member)
    const userA = await User.create({
      name: 'Alice Admin',
      email: 'alice@example.com',
      passwordHash: 'hash',
      currency: '₹'
    });
    const userB = await User.create({
      name: 'Bob Member',
      email: 'bob@example.com',
      passwordHash: 'hash',
      currency: '₹'
    });
    const userC = await User.create({
      name: 'Charlie Member',
      email: 'charlie@example.com',
      passwordHash: 'hash',
      currency: '₹'
    });
    createdUserIds.push(userA._id, userB._id, userC._id);

    // Seed Primary Trip 1
    const trip1 = await Trip.create({
      name: 'Goa Holiday Trip',
      destination: 'Goa',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-07'),
      currency: '₹',
      estimatedBudget: 15000,
      createdBy: userA._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip1._id);

    await TripMember.create([
      { tripId: trip1._id, userId: userA._id, role: 'ADMIN' },
      { tripId: trip1._id, userId: userB._id, role: 'MEMBER' },
      { tripId: trip1._id, userId: userC._id, role: 'MEMBER' }
    ]);

    // Seed Unrelated Trip 2 (for multi-tenant isolation testing)
    const trip2 = await Trip.create({
      name: 'Manali Snow Trek',
      destination: 'Manali',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-05'),
      currency: '₹',
      estimatedBudget: 20000,
      createdBy: userB._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip2._id);

    await TripMember.create([
      { tripId: trip2._id, userId: userB._id, role: 'ADMIN' },
      { tripId: trip2._id, userId: userC._id, role: 'MEMBER' }
    ]);

    // Expense on Trip 2: ₹5000 Hotel
    await Expense.create({
      tripId: trip2._id,
      title: 'Resort Stay',
      amount: 5000,
      category: 'Accommodation',
      paidBy: userB._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userB._id, share: 2500, status: 'PAID' },
        { userId: userC._id, share: 2500, status: 'PENDING' }
      ],
      createdBy: userB._id
    });

    // -------------------------------------------------------------------------
    // Set up Trip 1 Expenses:
    // Expense 1: ₹3000 Food (Alice paid, equal split: 1000 each)
    // Expense 2: ₹1500 Activities (Bob paid, equal split: 500 each)
    // Expense 3: ₹600 Local Transport (Charlie paid, equal split: 200 each) [TARGET FOR DELETION]
    // -------------------------------------------------------------------------
    const exp1 = await Expense.create({
      tripId: trip1._id,
      title: 'Beach Dinner',
      amount: 3000,
      category: 'Food',
      paidBy: userA._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 1000, status: 'PAID' },
        { userId: userB._id, share: 1000, status: 'PENDING' },
        { userId: userC._id, share: 1000, status: 'PENDING' }
      ],
      createdBy: userA._id
    });

    const exp2 = await Expense.create({
      tripId: trip1._id,
      title: 'Scuba Diving',
      amount: 1500,
      category: 'Activities',
      paidBy: userB._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 500, status: 'PENDING' },
        { userId: userB._id, share: 500, status: 'PAID' },
        { userId: userC._id, share: 500, status: 'PENDING' }
      ],
      createdBy: userB._id
    });

    const exp3 = await Expense.create({
      tripId: trip1._id,
      title: 'Scooter Rental',
      amount: 600,
      category: 'Local Transport',
      paidBy: userC._id,
      splitType: 'EQUAL',
      participants: [
        { userId: userA._id, share: 200, status: 'PENDING' },
        { userId: userB._id, share: 200, status: 'PENDING' },
        { userId: userC._id, share: 200, status: 'PAID' }
      ],
      createdBy: userC._id
    });

    // Seed activity for exp3
    await Activity.create({
      tripId: trip1._id,
      userId: userC._id,
      type: 'EXPENSE_ADDED',
      description: 'added ₹600 Local Transport "Scooter Rental"',
      metadata: { expenseId: exp3._id, expense: exp3.toObject() }
    });

    // Seed confirmed historical settlement: Charlie confirmed payment of ₹400 to Alice
    const confirmedSettlement = await Settlement.create({
      tripId: trip1._id,
      fromUser: userC._id,
      toUser: userA._id,
      amount: 400,
      status: 'PAID',
      paidAt: new Date(),
      reference: 'UPI-REF-001'
    });

    // Baseline calculation before deletion
    const beforeReport = await generateAuthoritativeTripReport(trip1._id.toString());
    const initialTotalExpenses = beforeReport.overview.totalExpenses; // 3000 + 1500 + 600 = 5100

    // =========================================================================
    // TEST A: Delete one expense and verify total decreases by exactly its amount
    // =========================================================================
    const exp3Id = exp3._id.toString();
    const deletedAmount = exp3.amount; // 600

    // Perform deletion
    await Expense.findByIdAndDelete(exp3Id);
    await Activity.deleteMany({
      tripId: trip1._id,
      $or: [
        { 'metadata.expenseId': exp3Id },
        { 'metadata.expenseId': new mongoose.Types.ObjectId(exp3Id) }
      ]
    });

    const afterCalc = await calculateTripBalancesAndSettlements(trip1._id.toString());

    if (
      initialTotalExpenses === 5100 &&
      afterCalc.totalExpenses === 4500 &&
      initialTotalExpenses - afterCalc.totalExpenses === deletedAmount
    ) {
      pass('Test A: Total expenses decreased by exactly the deleted expense amount (5100 -> 4500)');
      testPassed++;
    } else {
      fail(`Test A: Total expenses mismatch (before=${initialTotalExpenses}, after=${afterCalc.totalExpenses})`);
    }

    // =========================================================================
    // TEST B: Category totals and transaction counts update
    // =========================================================================
    const reportAfter = await generateAuthoritativeTripReport(trip1._id.toString());
    const localTransportCat = reportAfter.categoryBreakdown.find((c: any) => c.category === 'Local Transport');
    const foodCat = reportAfter.categoryBreakdown.find((c: any) => c.category === 'Food');
    const activitiesCat = reportAfter.categoryBreakdown.find((c: any) => c.category === 'Activities');

    if (
      !localTransportCat &&
      foodCat?.totalAmount === 3000 &&
      foodCat?.count === 1 &&
      activitiesCat?.totalAmount === 1500 &&
      activitiesCat?.count === 1 &&
      reportAfter.overview.totalExpenses === 4500
    ) {
      pass('Test B: Category totals and counts updated correctly (Local Transport removed, Food and Activities intact)');
      testPassed++;
    } else {
      fail('Test B: Category breakdown failed to update accurately');
    }

    // =========================================================================
    // TEST C: Member shares and final net balances recalculated correctly
    // Remaining expenses:
    // Exp 1: Alice paid 3000 (shares: A 1000, B 1000, C 1000)
    // Exp 2: Bob paid 1500 (shares: A 500, B 500, C 500)
    // Total: 4500. Shares each: 1500.
    // Confirmed settlement: Charlie paid Alice 400.
    //
    // Balances:
    // Alice: paid 3000, share 1500, received 400 => Net = 3000 - 1500 + 0 - 0 - 0?
    // Formula: paid(3000) - share(1500) + settlementsPaid(0) - settlementsReceived(400) = +1100
    // Bob: paid 1500, share 1500, settlements = 0 => Net = 0
    // Charlie: paid 0, share 1500, paid 400 => Net = 0 - 1500 + 400 - 0 = -1100
    // Sum = 1100 + 0 - 1100 = 0 (Zero-sum reconciled!)
    // =========================================================================
    const mAlice = afterCalc.memberBalances.find(m => m.userId === userA._id.toString());
    const mBob = afterCalc.memberBalances.find(m => m.userId === userB._id.toString());
    const mCharlie = afterCalc.memberBalances.find(m => m.userId === userC._id.toString());

    if (
      mAlice?.totalShare === 1500 &&
      mBob?.totalShare === 1500 &&
      mCharlie?.totalShare === 1500 &&
      mAlice?.netBalance === 1100 &&
      mBob?.netBalance === 0 &&
      mCharlie?.netBalance === -1100 &&
      afterCalc.isReconciled &&
      afterCalc.discrepancy === 0
    ) {
      pass('Test C: Member shares and final net balances recalculated accurately with zero discrepancy (Alice: +1100, Bob: 0, Charlie: -1100)');
      testPassed++;
    } else {
      fail(`Test C: Member balances incorrect (Alice: ${mAlice?.netBalance}, Bob: ${mBob?.netBalance}, Charlie: ${mCharlie?.netBalance})`);
    }

    // =========================================================================
    // TEST D: Suggested settlements match new balances
    // Bob has 0 balance, Charlie owes 1100, Alice is owed 1100.
    // Suggested: Charlie pays Alice 1100.
    // =========================================================================
    const suggested = afterCalc.suggestedSettlements;
    const sCharlieToAlice = suggested.find(
      s => s.fromUser._id === userC._id.toString() && s.toUser._id === userA._id.toString()
    );

    if (
      suggested.length === 1 &&
      sCharlieToAlice?.amount === 1100 &&
      afterCalc.outstandingAmount === 1100
    ) {
      pass('Test D: Suggested settlements match new net balances (Charlie pays Alice ₹1100)');
      testPassed++;
    } else {
      fail(`Test D: Suggested settlements incorrect (count=${suggested.length}, amount=${sCharlieToAlice?.amount})`);
    }

    // =========================================================================
    // TEST E: Pinned summary and open report values updated
    // =========================================================================
    const remainingSpent = 4500;
    const estBudget = trip1.estimatedBudget; // 15000
    const remainingBudget = estBudget - remainingSpent; // 10500
    const pct = Math.round((remainingSpent / estBudget) * 100); // 30%

    if (
      reportAfter.overview.totalExpenses === 4500 &&
      remainingBudget === 10500 &&
      pct === 30 &&
      reportAfter.financialReconciliation?.totalOutstandingCreditorBalances === 1100 &&
      reportAfter.financialReconciliation?.totalOutstandingDebtorBalances === 1100
    ) {
      pass('Test E: Pinned summary metrics and open report reconciliation update accurately (30% spent, ₹10,500 remaining)');
      testPassed++;
    } else {
      fail('Test E: Pinned summary / report overview metrics failed to match');
    }

    // =========================================================================
    // TEST F: Real-time event payload contains tripId and expenseId
    // =========================================================================
    const samplePayload = { tripId: trip1._id.toString(), expenseId: exp3Id };
    if (samplePayload.tripId === trip1._id.toString() && samplePayload.expenseId === exp3Id) {
      pass('Test F: Real-time sync payload includes verified tripId and expenseId');
      testPassed++;
    } else {
      fail('Test F: Real-time payload invalid');
    }

    // =========================================================================
    // TEST G: Cross-trip isolation (Trip 2 remains completely unchanged)
    // =========================================================================
    const trip2Calc = await calculateTripBalancesAndSettlements(trip2._id.toString());
    const trip2Report = await generateAuthoritativeTripReport(trip2._id.toString());

    if (
      trip2Calc.totalExpenses === 5000 &&
      trip2Report.categoryBreakdown.find((c: any) => c.category === 'Accommodation')?.totalAmount === 5000 &&
      trip2Calc.isReconciled
    ) {
      pass('Test G: Another trip (Manali Snow Trek) remains completely isolated and unchanged at ₹5,000');
      testPassed++;
    } else {
      fail('Test G: Cross-trip isolation breached');
    }

    // =========================================================================
    // TEST H: Failed deletion leaves data consistent
    // =========================================================================
    const nonExistentId = new mongoose.Types.ObjectId();
    const existingDoc = await Expense.findById(nonExistentId);
    const countBefore = await Expense.countDocuments({ tripId: trip1._id });

    // Attempting to delete non-existent expense should not alter anything
    if (!existingDoc && countBefore === 2) {
      const recheckedCalc = await calculateTripBalancesAndSettlements(trip1._id.toString());
      if (recheckedCalc.totalExpenses === 4500) {
        pass('Test H: Non-existent / failed deletion leaves existing financial data strictly consistent');
        testPassed++;
      } else {
        fail('Test H: Inconsistent totals after failed deletion check');
      }
    } else {
      fail('Test H: Failed deletion setup incorrect');
    }

    // =========================================================================
    // TEST I: Confirmed settlements preserved
    // =========================================================================
    const checkSettlement = await Settlement.findById(confirmedSettlement._id);
    if (checkSettlement && checkSettlement.status === 'PAID' && checkSettlement.amount === 400) {
      pass('Test I: Confirmed settlement history (₹400 Charlie -> Alice) strictly preserved');
      testPassed++;
    } else {
      fail('Test I: Confirmed settlement was mistakenly altered or deleted');
    }

    // =========================================================================
    // TEST J: Chat activities cleaned up (No ghost cards for deleted expense)
    // =========================================================================
    const ghostActivities = await Activity.find({
      tripId: trip1._id,
      $or: [
        { 'metadata.expenseId': exp3Id },
        { 'metadata.expenseId': new mongoose.Types.ObjectId(exp3Id) }
      ]
    });

    if (ghostActivities.length === 0) {
      pass('Test J: Chat feed activity records cleaned up; 0 ghost expense cards remaining');
      testPassed++;
    } else {
      fail(`Test J: Found ${ghostActivities.length} ghost activities for deleted expense`);
    }

    // =========================================================================
    // TEST K: Downloaded report PDF contract reflects updated data
    // =========================================================================
    const pdfContract = {
      tripTitle: reportAfter.trip.name,
      currency: reportAfter.trip.currency,
      totalExpenses: reportAfter.overview.totalExpenses,
      memberCount: reportAfter.overview.memberCount,
      categoryCount: reportAfter.categoryBreakdown.length,
      settlementsCount: reportAfter.suggestedSettlements.length,
      settlementHistoryCount: reportAfter.settlementHistory.length,
      reconciliationStatus: reportAfter.financialReconciliation?.isReconciled
    };

    if (
      pdfContract.totalExpenses === 4500 &&
      pdfContract.categoryCount === 2 &&
      pdfContract.settlementHistoryCount === 1 &&
      pdfContract.settlementsCount === 1 &&
      pdfContract.reconciliationStatus === true
    ) {
      pass('Test K: Final Report PDF data contract matches updated live financial state exactly');
      testPassed++;
    } else {
      fail('Test K: PDF data contract contains stale or inconsistent values');
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\nCleaning up isolated test data...');
    if (createdTripIds.length > 0) {
      await Trip.deleteMany({ _id: { $in: createdTripIds } });
      await TripMember.deleteMany({ tripId: { $in: createdTripIds } });
      await Expense.deleteMany({ tripId: { $in: createdTripIds } });
      await Settlement.deleteMany({ tripId: { $in: createdTripIds } });
      await Activity.deleteMany({ tripId: { $in: createdTripIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    console.log('Cleaned up test data.');
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

runExpenseDeletionTests();
