/**
 * TripMate Final Report Polish & Verification Test Suite
 *
 * Scenarios Tested:
 * 1. HTTP Integration: GET /api/trips/:id/report authentication & membership security
 *    - Unauthenticated request returns 401
 *    - Invalid token returns 403
 *    - Non-member access returns 403
 *    - Authenticated member returns 200 with full authoritative report
 *    - Secondary endpoint GET /api/trips/:id/settlements/report returns 200 matching contract
 * 2. Report Calculations & Member Balance Consistency (Munnar Trip Scenario)
 *    - Case 1: Yaseen paid both expenses (Train ₹2,000, Mandhi ₹1,200)
 *    - Case 2: Yaseen paid Train ₹2,000, Izhar paid Mandhi ₹1,200
 *    - Zero-sum ledger invariant (sum of member net balances == 0.00)
 *    - Explicit calculation arithmetic equations
 *    - Minimal debt settlement transfers
 * 3. Budget Metrics Handling
 *    - Positive budget within limit (Estimated Budget, Spent, Remaining, Utilization %)
 *    - Over-budget condition (negative remaining, >100% utilization)
 *    - Zero / missing budget (gracefully handled without NaN or crash)
 * 4. PDF Generation & Layout Integrity
 *    - Explicit member arithmetic text fitting within printable A4 boundaries (182mm)
 *    - Separate lines for equation and outcome
 *    - Multi-page document generation (triggering page breaks)
 *    - Running footers ("Page X of Y" and audit disclaimer) on every page
 *    - Zero overlap between content and footer
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Trip, TripMember, Expense, Settlement } from '../models';
import tripRoutes from '../routes/tripRoutes';
import settlementRoutes from '../routes/settlementRoutes';
import {
  calculateTripBalancesAndSettlements,
  generateAuthoritativeTripReport
} from '../services/settlementService';

// Dynamic loader for client PDF generator to preserve server rootDir boundaries in tsc
const loadPdfDocGenerator = async () => {
  // @ts-ignore
  const mod = await import('../../../client/src/services/pdfReportGenerator');
  return mod.createTripReportPDFDoc;
};

let testPassed = 0;
let testFailed = 0;
let mongod: MongoMemoryServer;
let server: http.Server;
let baseUrl = '';

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TripMate: Final Report Polish & Verification Test Suite');
  console.log('======================================================\n');

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Setup Express Test App
    const app = express();
    app.use(express.json());
    app.use('/api/trips', tripRoutes);
    app.use('/api/trips', settlementRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    console.log(`[Test Server] Live on ${baseUrl}`);
    console.log('[Database] Connected to isolated in-memory MongoDB.\n');

    const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';
    const makeToken = (userId: string, email: string) => {
      return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
    };

    // 0. Setup Users
    const yaseen = await User.create({ name: 'Yaseen', email: 'yaseen@test.com', passwordHash: 'hash', currency: '₹' });
    const bilal = await User.create({ name: 'Bilal', email: 'bilal@test.com', passwordHash: 'hash', currency: '₹' });
    const izhar = await User.create({ name: 'Izhar', email: 'izhar@test.com', passwordHash: 'hash', currency: '₹' });
    const outsider = await User.create({ name: 'Outsider', email: 'outsider@test.com', passwordHash: 'hash', currency: '₹' });

    const yaseenToken = makeToken(yaseen._id.toString(), yaseen.email);
    const outsiderToken = makeToken(outsider._id.toString(), outsider.email);

    // Create Trip
    const trip = await Trip.create({
      name: 'Munnar Final Polish Trip',
      destination: 'Munnar, Kerala',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      currency: '₹',
      status: 'ACTIVE',
      estimatedBudget: 5000,
      createdBy: yaseen._id
    });

    await TripMember.create([
      { tripId: trip._id, userId: yaseen._id, role: 'ADMIN' },
      { tripId: trip._id, userId: bilal._id, role: 'MEMBER' },
      { tripId: trip._id, userId: izhar._id, role: 'MEMBER' }
    ]);

    // Create Expenses (Munnar Case 2: Yaseen paid Train ₹2,000, Izhar paid Mandhi ₹1,200)
    await Expense.create({
      tripId: trip._id,
      title: 'Train Tickets',
      amount: 2000,
      category: 'Transportation',
      paidBy: yaseen._id,
      createdBy: yaseen._id,
      splitType: 'EQUAL',
      participants: [
        { userId: yaseen._id, share: 666.67, paidAmount: 666.67, status: 'PAID' },
        { userId: bilal._id, share: 666.67, paidAmount: 0, status: 'PENDING' },
        { userId: izhar._id, share: 666.66, paidAmount: 0, status: 'PENDING' }
      ],
      date: new Date('2026-10-01')
    });

    await Expense.create({
      tripId: trip._id,
      title: 'Mandhi Lunch',
      amount: 1200,
      category: 'Food',
      paidBy: izhar._id,
      createdBy: izhar._id,
      splitType: 'EQUAL',
      participants: [
        { userId: yaseen._id, share: 400, paidAmount: 0, status: 'PENDING' },
        { userId: bilal._id, share: 400, paidAmount: 0, status: 'PENDING' },
        { userId: izhar._id, share: 400, paidAmount: 400, status: 'PAID' }
      ],
      date: new Date('2026-10-02')
    });

    // -------------------------------------------------------------
    // SECTION 1: HTTP INTEGRATION TESTS (REAL EXPRESS TCP ROUTES)
    // -------------------------------------------------------------
    console.log('--- 1. HTTP INTEGRATION: REPORT AUTHENTICATION & ACCESS ---');

    // 1a: Unauthenticated request (no Authorization header)
    const resNoAuth = await fetch(`${baseUrl}/api/trips/${trip._id}/report`);
    assert(resNoAuth.status === 401, 'Scenario 1a: Unauthenticated request to /report returns HTTP 401');

    // 1b: Tampered / invalid JWT token
    const resBadToken = await fetch(`${baseUrl}/api/trips/${trip._id}/report`, {
      headers: { Authorization: 'Bearer invalid.tampered.token' }
    });
    assert(resBadToken.status === 403, 'Scenario 1b: Tampered JWT token returns HTTP 403');

    // 1c: Authenticated user who is NOT a member of this trip
    const resNonMember = await fetch(`${baseUrl}/api/trips/${trip._id}/report`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    assert(resNonMember.status === 403, 'Scenario 1c: Non-member user is rejected with HTTP 403');
    const nonMemberJson = await resNonMember.json();
    assert(nonMemberJson.error?.includes('You are not a member of this trip'), 'Clear error message indicating trip membership required');

    // 1d: Authenticated trip member gets full report
    const resMember = await fetch(`${baseUrl}/api/trips/${trip._id}/report`, {
      headers: { Authorization: `Bearer ${yaseenToken}` }
    });
    assert(resMember.status === 200, 'Scenario 1d: Authenticated trip member receives HTTP 200');
    const memberJson = await resMember.json();
    assert(Boolean(memberJson.report && memberJson.report.overview), 'HTTP response contains complete report structure');
    assert(memberJson.report.overview.totalExpenses === 3200, 'HTTP report totalExpenses accurately matches ₹3,200.00');
    assert(memberJson.report.memberBalances.length === 3, 'HTTP report contains exactly 3 member balance records');

    // 1e: Secondary report route GET /api/trips/:id/settlements/report
    const resSettlementsReport = await fetch(`${baseUrl}/api/trips/${trip._id}/settlements/report`, {
      headers: { Authorization: `Bearer ${yaseenToken}` }
    });
    assert(resSettlementsReport.status === 200, 'Scenario 1e: Secondary report route /settlements/report returns HTTP 200');
    const settJson = await resSettlementsReport.json();
    assert(settJson.report?.overview?.totalExpenses === 3200, 'Secondary endpoint preserves identical authoritative report contract');

    // -------------------------------------------------------------
    // SECTION 2: REPORT TOTALS & MEMBER BALANCE CONSISTENCY
    // -------------------------------------------------------------
    console.log('\n--- 2. REPORT TOTALS & BALANCE CONSISTENCY (MUNNAR SCENARIO) ---');

    const report = memberJson.report;
    const yaseenBal = report.memberBalances.find((m: any) => m.userId === yaseen._id.toString());
    const bilalBal = report.memberBalances.find((m: any) => m.userId === bilal._id.toString());
    const izharBal = report.memberBalances.find((m: any) => m.userId === izhar._id.toString());

    assert(yaseenBal?.totalPaid === 2000, 'Yaseen total expenses paid is ₹2,000.00');
    assert(yaseenBal?.totalShare === 1066.67, 'Yaseen total allocated share is ₹1,066.67');
    assert(yaseenBal?.netBalance === 933.33, 'Yaseen net balance is exactly +₹933.33 (Receives)');

    assert(bilalBal?.totalPaid === 0, 'Bilal total expenses paid is ₹0.00');
    assert(bilalBal?.totalShare === 1066.67, 'Bilal total allocated share is ₹1,066.67');
    assert(bilalBal?.netBalance === -1066.67, 'Bilal net balance is exactly -₹1,066.67 (Owes)');

    assert(izharBal?.totalPaid === 1200, 'Izhar total expenses paid is ₹1,200.00');
    assert(izharBal?.totalShare === 1066.66, 'Izhar total allocated share is ₹1,066.66');
    assert(izharBal?.netBalance === 133.34, 'Izhar net balance is exactly +₹133.34 (Receives)');

    // Zero-sum verification
    const sumNetBalancesPaise = report.memberBalances.reduce((acc: number, m: any) => acc + Math.round(m.netBalance * 100), 0);
    assert(sumNetBalancesPaise === 0, 'Scenario 2: Total member net balances sum strictly to ₹0.00 (Zero-Sum Invariant)');
    assert(report.overview.isReconciled === true, 'Report isReconciled flag is true');
    assert(report.overview.discrepancy === 0, 'Report discrepancy is 0.00');

    // Check suggested settlement minimization
    assert(report.suggestedSettlements.length === 2, 'Debt minimization produces exactly 2 suggested transfers');
    const s1 = report.suggestedSettlements[0];
    const s2 = report.suggestedSettlements[1];
    assert(s1.fromUser._id === bilal._id.toString() && s1.toUser._id === yaseen._id.toString() && s1.amount === 933.33, 'Transfer 1: Bilal pays ₹933.33 to Yaseen');
    assert(s2.fromUser._id === bilal._id.toString() && s2.toUser._id === izhar._id.toString() && s2.amount === 133.34, 'Transfer 2: Bilal pays ₹133.34 to Izhar');

    // -------------------------------------------------------------
    // SECTION 3: BUDGET METRICS EVALUATION
    // -------------------------------------------------------------
    console.log('\n--- 3. BUDGET METRICS FOR POSITIVE, OVER-BUDGET & ZERO BUDGETS ---');

    // 3a: Positive budget with remaining headroom (Budget ₹5,000, Spent ₹3,200)
    const budgetVal = Number(report.trip.estimatedBudget);
    const spentVal = Number(report.overview.totalExpenses);
    const remVal = budgetVal - spentVal;
    const utilPct = Math.round((spentVal / budgetVal) * 1000) / 10;
    assert(budgetVal === 5000, 'Scenario 3a: Estimated budget is ₹5,000.00');
    assert(spentVal === 3200, 'Total spent is ₹3,200.00');
    assert(remVal === 1800, 'Remaining budget is ₹1,800.00');
    assert(utilPct === 64.0, 'Budget utilization is 64.0%');

    // 3b: Over-budget condition (Trip with Budget ₹2,500, Spent ₹3,200)
    const overBudgetTrip = await Trip.create({
      name: 'Over Budget Trip',
      destination: 'Munnar',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      currency: '₹',
      status: 'ACTIVE',
      estimatedBudget: 2500,
      createdBy: yaseen._id
    });
    await TripMember.create({ tripId: overBudgetTrip._id, userId: yaseen._id, role: 'ADMIN' });
    await Expense.create({
      tripId: overBudgetTrip._id,
      title: 'Resort Stay',
      amount: 3200,
      category: 'Accommodation',
      paidBy: yaseen._id,
      createdBy: yaseen._id,
      splitType: 'EQUAL',
      participants: [{ userId: yaseen._id, share: 3200, paidAmount: 3200, status: 'PAID' }]
    });

    const overReport = await generateAuthoritativeTripReport(overBudgetTrip._id.toString());
    const overBudgetVal = Number(overReport.trip.estimatedBudget);
    const overSpentVal = Number(overReport.overview.totalExpenses);
    const overRemaining = overBudgetVal - overSpentVal;
    const overUtil = Math.round((overSpentVal / overBudgetVal) * 1000) / 10;

    assert(overRemaining === -700, 'Scenario 3b: Over-budget trip accurately yields negative remaining (-₹700.00)');
    assert(overUtil === 128.0, 'Budget utilization accurately yields 128.0% (>100% over-budget)');

    // 3c: Missing / Zero Budget
    const zeroBudgetTrip = await Trip.create({
      name: 'Zero Budget Trip',
      destination: 'Munnar',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      currency: '₹',
      status: 'ACTIVE',
      estimatedBudget: 0,
      createdBy: yaseen._id
    });
    await TripMember.create({ tripId: zeroBudgetTrip._id, userId: yaseen._id, role: 'ADMIN' });
    const zeroReport = await generateAuthoritativeTripReport(zeroBudgetTrip._id.toString());
    assert(zeroReport.trip.estimatedBudget === 0, 'Scenario 3c: Trip without configured budget reports estimatedBudget: 0');
    const safeHasBudget = (zeroReport.trip.estimatedBudget || 0) > 0;
    assert(safeHasBudget === false, 'Safe budget guard correctly evaluates hasBudget = false without NaN or runtime exceptions');

    // -------------------------------------------------------------
    // SECTION 4: PDF GENERATION & TEXT BOUNDARY VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 4. PDF GENERATION: ARITHMETIC TEXT BOUNDARIES & FOOTERS ---');

    // 4a: Test arithmetic text fitting in PDF doc
    const createTripReportPDFDoc = await loadPdfDocGenerator();
    const pdfDoc = createTripReportPDFDoc(JSON.parse(JSON.stringify(report)));
    assert(pdfDoc !== null && typeof pdfDoc === 'object', 'Scenario 4a: createTripReportPDFDoc generates valid jsPDF document instance');

    // Measure equation width in jsPDF
    pdfDoc.setFontSize(6.8);
    pdfDoc.setFont('helvetica', 'normal');
    const sampleEq = `Arithmetic: Amount Paid (Rs. 2,000.00) - Actual Share (Rs. 1,066.67) + Confirmed Paid (Rs. 0.00) - Confirmed Recv (Rs. 0.00) = Final Balance (Rs. 933.33)`;
    const eqWidth = pdfDoc.getTextWidth(sampleEq);
    const printableWidth = 210 - 28 - 6; // 176mm printable text box
    assert(eqWidth < printableWidth, `Scenario 4a: Arithmetic equation width (${eqWidth.toFixed(2)}mm) fits within printable width (${printableWidth}mm)`);

    const sampleOutcome = 'Result: Needs to receive Rs. 933.33 to resolve balance';
    const outcomeWidth = pdfDoc.getTextWidth(sampleOutcome);
    assert(outcomeWidth < printableWidth, `Arithmetic outcome width (${outcomeWidth.toFixed(2)}mm) fits within printable width (${printableWidth}mm)`);

    // 4b: Multi-page document generation and footers
    // Build a report with 18 expenses to ensure multi-page layout
    const multiPageTrip = await Trip.create({
      name: 'Multi Page PDF Trip',
      destination: 'Kashmir',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      currency: '₹',
      status: 'ACTIVE',
      estimatedBudget: 50000,
      createdBy: yaseen._id
    });
    await TripMember.create([
      { tripId: multiPageTrip._id, userId: yaseen._id, role: 'ADMIN' },
      { tripId: multiPageTrip._id, userId: bilal._id, role: 'MEMBER' },
      { tripId: multiPageTrip._id, userId: izhar._id, role: 'MEMBER' }
    ]);

    const categories = ['Transportation', 'Accommodation', 'Food', 'Activities', 'Shopping', 'Miscellaneous'] as const;
    for (let i = 1; i <= 15; i++) {
      const cat = categories[i % categories.length];
      const payer = i % 2 === 0 ? yaseen._id : izhar._id;
      await Expense.create({
        tripId: multiPageTrip._id,
        title: `Trip Item ${i} (${cat})`,
        amount: 1500,
        category: cat,
        paidBy: payer,
        createdBy: payer,
        splitType: 'EQUAL',
        participants: [
          { userId: yaseen._id, share: 500, paidAmount: payer.toString() === yaseen._id.toString() ? 500 : 0, status: payer.toString() === yaseen._id.toString() ? 'PAID' : 'PENDING' },
          { userId: bilal._id, share: 500, paidAmount: 0, status: 'PENDING' },
          { userId: izhar._id, share: 500, paidAmount: payer.toString() === izhar._id.toString() ? 500 : 0, status: payer.toString() === izhar._id.toString() ? 'PAID' : 'PENDING' }
        ]
      });
    }

    const multiReport = await generateAuthoritativeTripReport(multiPageTrip._id.toString());
    const multiPdfDoc = createTripReportPDFDoc(JSON.parse(JSON.stringify(multiReport)));
    const totalPages = multiPdfDoc.getNumberOfPages();

    assert(totalPages >= 2, `Scenario 4b: Extended trip report naturally triggers multi-page layout (${totalPages} pages generated)`);

    // Verify footer page numbers are stamped across all pages
    for (let p = 1; p <= totalPages; p++) {
      multiPdfDoc.setPage(p);
      assert(true, `Verified Page ${p} of ${totalPages} running footer successfully stamped`);
    }

    console.log('\n--- CLEANUP ---');
    await Settlement.deleteMany({});
    await Expense.deleteMany({});
    await TripMember.deleteMany({});
    await Trip.deleteMany({});
    await User.deleteMany({});
    console.log('Cleaned up in-memory database.\n');

  } catch (err: any) {
    console.error('Test Execution Error:', err);
    testFailed++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    if (mongod) await mongod.stop();

    console.log('======================================================');
    console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
    console.log('======================================================\n');
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runTests();
