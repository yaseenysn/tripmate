/**
 * TripMate Phase 2 — Application-Wide Input Validation and Injection Prevention Test Suite
 *
 * Verifies:
 * 1. XSS & HTML Injection Prevention: user inputs rendered as plain text, no script execution, client links sanitized.
 * 2. URL Scheme Validation: javascript:, data:, vbscript: rejected; http:, https:, and relative paths permitted.
 * 3. NoSQL Operator Injection: keys starting with $ or containing . rejected with HTTP 400 globally.
 * 4. Database Safety & ObjectId Validation: non-hex / malformed ObjectIds return HTTP 400 instead of 500 CastErrors.
 * 5. Numeric Bounds & Schema Constraints: negative amounts, 0-value expenses, inverted dates, oversized inputs rejected.
 * 6. Internationalization / Unicode Preservation: Malayalam (മലയാളം), apostrophes, and emoji strings work properly.
 * 7. Boundary Authorization & Role Enforcement: non-members, non-creators, sole admins protected against unauthorized modifications.
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User, Trip, TripMember, Expense, Budget, Booking, DocumentModel, Task, Poll, Activity, Notification } from '../models';
import { noSqlSanitizerMiddleware, isValidObjectId, isValidUrl, isSafeString, isValidEmail } from '../utils/validation';

// Routes
import authRoutes from '../routes/authRoutes';
import tripRoutes from '../routes/tripRoutes';
import expenseRoutes from '../routes/expenseRoutes';
import budgetRoutes from '../routes/budgetRoutes';
import bookingRoutes from '../routes/bookingRoutes';
import documentRoutes from '../routes/documentRoutes';
import taskRoutes from '../routes/taskRoutes';
import pollRoutes from '../routes/pollRoutes';
import activityRoutes from '../routes/activityRoutes';
import memberRoutes from '../routes/memberRoutes';
import inviteRoutes from '../routes/inviteRoutes';
import notificationRoutes from '../routes/notificationRoutes';

const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';

let mongod: MongoMemoryServer;
let server: http.Server;
let baseUrl = '';

let testPassed = 0;
let testFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testFailed++;
  }
}

const createToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
};

async function runTests() {
  console.log('\n======================================================');
  console.log('TripMate: Phase 2 Comprehensive Input Validation & Injection Prevention Suite');
  console.log('======================================================\n');

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[Database] Connected to isolated In-Memory MongoDB.\n');

    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(noSqlSanitizerMiddleware);

    // Mount Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/trips', tripRoutes);
    app.use('/api', inviteRoutes);
    app.use('/api/trips', memberRoutes);
    app.use('/api/trips', expenseRoutes);
    app.use('/api/trips', budgetRoutes);
    app.use('/api/trips', bookingRoutes);
    app.use('/api/trips', documentRoutes);
    app.use('/api/trips', taskRoutes);
    app.use('/api/trips', pollRoutes);
    app.use('/api/trips', activityRoutes);
    app.use('/api/notifications', notificationRoutes);

    // Global Error Handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err.name === 'CastError') {
        return res.status(400).json({ error: `Invalid ${err.path || 'identifier'} format` });
      }
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
      }
      res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });

    console.log(`[Test Server] Running at ${baseUrl}\n`);

    // Setup Test Users
    const adminUser = await User.create({
      name: 'Admin Alice',
      email: 'alice@example.com',
      passwordHash: 'hashedPassword123'
    });
    const bobUser = await User.create({
      name: 'Member Bob',
      email: 'bob@example.com',
      passwordHash: 'hashedPassword123'
    });
    const charlieUser = await User.create({
      name: 'Charlie Outsider',
      email: 'charlie@example.com',
      passwordHash: 'hashedPassword123'
    });

    const adminToken = createToken(adminUser._id.toString(), adminUser.email);
    const bobToken = createToken(bobUser._id.toString(), bobUser.email);
    const outsiderToken = createToken(charlieUser._id.toString(), charlieUser.email);

    // Setup Test Trip
    const testTrip = await Trip.create({
      name: 'Goa Holiday',
      destination: 'Goa',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-05'),
      estimatedBudget: 25000,
      currency: '₹',
      createdBy: adminUser._id,
      status: 'ACTIVE'
    });
    const tripId = testTrip._id.toString();

    const adminMember = await TripMember.create({
      tripId: testTrip._id,
      userId: adminUser._id,
      role: 'ADMIN'
    });
    const bobMember = await TripMember.create({
      tripId: testTrip._id,
      userId: bobUser._id,
      role: 'MEMBER'
    });

    // -------------------------------------------------------------
    // SECTION 1: URL Scheme Validation
    // -------------------------------------------------------------
    console.log('--- SECTION 1: URL Scheme Validation ---');

    assert(!isValidUrl('javascript:alert(1)'), 'isValidUrl rejects javascript: scheme');
    assert(!isValidUrl('data:text/html,<script>alert(1)</script>'), 'isValidUrl rejects data: scheme');
    assert(!isValidUrl('vbscript:msgbox("XSS")'), 'isValidUrl rejects vbscript: scheme');
    assert(!isValidUrl('file:///etc/passwd'), 'isValidUrl rejects file: scheme');
    assert(!isValidUrl('//evil.com/payload'), 'isValidUrl rejects protocol-relative URL');
    assert(isValidUrl('https://images.unsplash.com/photo-1'), 'isValidUrl accepts standard https: URL');
    assert(isValidUrl('http://localhost:3000/docs/receipt.pdf'), 'isValidUrl accepts http: URL');
    assert(isValidUrl('/documents/local-view.pdf'), 'isValidUrl accepts relative app path');

    // API Document Upload with javascript: URL rejected
    const docRes = await fetch(`${baseUrl}/api/trips/${tripId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Malicious Receipt',
        type: 'RECEIPT',
        fileUrl: 'javascript:alert(document.cookie)'
      })
    });
    assert(docRes.status === 400, 'POST /documents with javascript: URL returns HTTP 400 Bad Request');

    // API Booking with data: URL rejected
    const bookingRes = await fetch(`${baseUrl}/api/trips/${tripId}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        type: 'HOTEL',
        provider: 'Grand Palace',
        date: '2026-11-01',
        cost: 4500,
        attachmentUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
      })
    });
    assert(bookingRes.status === 400, 'POST /bookings with data: URL returns HTTP 400 Bad Request');

    // API Expense with javascript: receiptUrl rejected
    const expUrlRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Dinner at Beach',
        amount: 1500,
        category: 'FOOD',
        paidBy: adminUser._id.toString(),
        splitType: 'EQUAL',
        receiptUrl: 'javascript:alert(1)'
      })
    });
    assert(expUrlRes.status === 400, 'POST /expenses with javascript: receiptUrl returns HTTP 400 Bad Request');

    // -------------------------------------------------------------
    // SECTION 2: NoSQL Query Operator Injection Prevention
    // -------------------------------------------------------------
    console.log('\n--- SECTION 2: NoSQL Query Operator Injection Prevention ---');

    // Injected $gt operator in login body
    const nosqlLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: { $gt: '' },
        password: 'password123'
      })
    });
    assert(nosqlLoginRes.status === 400, 'Login with NoSQL $gt operator in body is blocked by middleware (HTTP 400)');

    // Injected $ne operator in trip patch body
    const nosqlPatchRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: { $ne: null }
      })
    });
    assert(nosqlPatchRes.status === 400, 'Trip update with NoSQL $ne operator is blocked by middleware (HTTP 400)');

    // Injected field with dot notation (e.g. "admin.role")
    const nosqlDotRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        'settings.isAdmin': true
      })
    });
    assert(nosqlDotRes.status === 400, 'Request with dot notation field is blocked by middleware (HTTP 400)');

    // -------------------------------------------------------------
    // SECTION 3: Invalid ObjectId Handling (No 500 CastErrors)
    // -------------------------------------------------------------
    console.log('\n--- SECTION 3: Invalid ObjectId Handling (HTTP 400, No 500) ---');

    // Malformed tripId in GET /api/trips/:id
    const badTripRes = await fetch(`${baseUrl}/api/trips/invalid-hex-trip-id`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(badTripRes.status === 400, 'GET /trips/invalid-id returns HTTP 400 (not 500 CastError)');

    // Malformed expenseId in PATCH /api/trips/:id/expenses/:expenseId
    const badExpRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses/not-a-valid-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 500 })
    });
    assert(badExpRes.status === 400, 'PATCH /expenses/not-a-valid-id returns HTTP 400');

    // Malformed taskId in DELETE /api/trips/:id/tasks/:taskId
    const badTaskRes = await fetch(`${baseUrl}/api/trips/${tripId}/tasks/fake-id`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(badTaskRes.status === 400, 'DELETE /tasks/fake-id returns HTTP 400');

    // Malformed pollId in POST /api/trips/:id/polls/:pollId/vote
    const badPollRes = await fetch(`${baseUrl}/api/trips/${tripId}/polls/xyz123/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ optionId: 'opt1' })
    });
    assert(badPollRes.status === 400, 'POST /polls/xyz123/vote returns HTTP 400');

    // Malformed notification ID in PATCH /api/notifications/:id/read
    const badNotifRes = await fetch(`${baseUrl}/api/notifications/invalid-id/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(badNotifRes.status === 400, 'PATCH /notifications/invalid-id/read returns HTTP 400');

    // -------------------------------------------------------------
    // SECTION 4: Numeric Bounds & Schema Constraints
    // -------------------------------------------------------------
    console.log('\n--- SECTION 4: Numeric Bounds & Schema Constraints ---');

    // Negative expense amount
    const negExpRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Taxi Ride',
        amount: -250,
        category: 'TRANSPORT',
        paidBy: adminUser._id.toString(),
        splitType: 'EQUAL'
      })
    });
    assert(negExpRes.status === 400, 'Creating expense with negative amount is rejected (HTTP 400)');

    // Zero expense amount
    const zeroExpRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Free Coffee',
        amount: 0,
        category: 'FOOD',
        paidBy: adminUser._id.toString(),
        splitType: 'EQUAL'
      })
    });
    assert(zeroExpRes.status === 400, 'Creating expense with amount 0 is rejected (HTTP 400)');

    // Inverted Trip Dates (endDate < startDate)
    const invertedDatesRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Inverted Dates Trip',
        destination: 'Manali',
        startDate: '2026-12-10',
        endDate: '2026-12-05',
        estimatedBudget: 10000
      })
    });
    assert(invertedDatesRes.status === 400, 'Trip creation with endDate earlier than startDate is rejected (HTTP 400)');

    // Poll with less than 2 options
    const singleOptionPollRes = await fetch(`${baseUrl}/api/trips/${tripId}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        question: 'Should we rent bikes?',
        options: ['Yes']
      })
    });
    assert(singleOptionPollRes.status === 400, 'Poll creation with less than 2 options is rejected (HTTP 400)');

    // Poll with more than 20 options (DoS prevention)
    const tooManyOptions = Array.from({ length: 25 }, (_, i) => `Option ${i + 1}`);
    const oversizedPollRes = await fetch(`${baseUrl}/api/trips/${tripId}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        question: 'Too many options poll',
        options: tooManyOptions
      })
    });
    assert(oversizedPollRes.status === 400, 'Poll creation with over 20 options is rejected (HTTP 400)');

    // -------------------------------------------------------------
    // SECTION 5: Internationalization (Malayalam, Unicode, Apostrophes)
    // -------------------------------------------------------------
    console.log('\n--- SECTION 5: Internationalization & Unicode Preservation ---');

    // Create trip with Malayalam destination & apostrophe
    const malayalamTripRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'യാസീന്റെ ഗോവൻ യാത്ര',
        destination: "O'Neill's Beach Resort, Goa",
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        estimatedBudget: 35000,
        currency: '₹',
        description: 'സുഹൃത്തുക്കളുമൊത്തുള്ള ആഹ്ലാദകരമായ ഒരു അവധിക്കാല യാത്ര.'
      })
    });
    assert(malayalamTripRes.status === 201, 'Trip with legitimate Malayalam script and apostrophes created successfully (HTTP 201)');
    const malayalamTripData = await malayalamTripRes.json();
    assert(malayalamTripData.trip.name === 'യാസീന്റെ ഗോവൻ യാത്ര', 'Malayalam trip title preserved intact without corruption');

    // Send chat message in Malayalam
    const chatMalayalamRes = await fetch(`${baseUrl}/api/trips/${tripId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        message: 'യാത്രയ്ക്ക് എല്ലാവർക്കും സ്വാഗതം! സന്തോഷകരമായ യാത്ര ആശംസിക്കുന്നു.'
      })
    });
    assert(chatMalayalamRes.status === 201, 'Chat message in Malayalam sent successfully (HTTP 201)');

    // Expense with apostrophe and Unicode note
    const expMalayalamRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: "Kallu's Seafood & തട്ടുകട",
        amount: 1850,
        category: 'FOOD',
        paidBy: adminUser._id.toString(),
        splitType: 'EQUAL',
        notes: 'രുചികരമായ മീൻ കറിയും ചോറും (Delicious Fish Curry & Rice)'
      })
    });
    assert(expMalayalamRes.status === 201, 'Expense with apostrophe and Malayalam notes created successfully (HTTP 201)');

    // -------------------------------------------------------------
    // SECTION 6: XSS & HTML Script Tag Safety
    // -------------------------------------------------------------
    console.log('\n--- SECTION 6: XSS & HTML Injection Safety ---');

    // Send chat message containing HTML tags and event handlers
    const xssChatRes = await fetch(`${baseUrl}/api/trips/${tripId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        message: '<script>alert("XSS")</script><img src="x" onerror="evil()">'
      })
    });
    assert(xssChatRes.status === 201, 'Chat message containing raw HTML tags is saved as harmless string');
    const xssChatData = await xssChatRes.json();
    assert(
      xssChatData.activity.description.includes('<script>alert("XSS")</script>'),
      'Raw input preserved as text string (escaped safely in React JSX)'
    );

    // Attempting to spoof system event type (e.g. SETTLEMENT_PAID) via chat POST
    const spoofActivityRes = await fetch(`${baseUrl}/api/trips/${tripId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        type: 'SETTLEMENT_PAID',
        message: 'Admin paid 5000'
      })
    });
    assert(spoofActivityRes.status === 400, 'Activity route rejects spoofed system event type (HTTP 400)');

    // -------------------------------------------------------------
    // SECTION 7: Boundary Authorization & Role Protection
    // -------------------------------------------------------------
    console.log('\n--- SECTION 7: Boundary Authorization & Role Protection ---');

    // 1. Non-member cannot add expense to trip
    const nonMemberExpRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outsiderToken}` },
      body: JSON.stringify({
        title: 'Intruder Expense',
        amount: 1000,
        category: 'OTHER',
        paidBy: charlieUser._id.toString(),
        splitType: 'EQUAL'
      })
    });
    assert(nonMemberExpRes.status === 403, 'Non-trip member is blocked from creating expenses (HTTP 403)');

    // 2. Member cannot assign expense paidBy to a non-member
    const invalidPayerExpRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Payment by outsider',
        amount: 800,
        category: 'OTHER',
        paidBy: charlieUser._id.toString(), // Charlie is not a member!
        splitType: 'EQUAL'
      })
    });
    assert(invalidPayerExpRes.status === 400, 'Assigning non-member as expense paidBy is rejected (HTTP 400)');

    // 3. Member cannot assign expense split participant to a non-member
    const invalidParticipantExpRes = await fetch(`${baseUrl}/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Split with outsider',
        amount: 1200,
        category: 'OTHER',
        paidBy: adminUser._id.toString(),
        splitType: 'CUSTOM',
        participants: [
          { userId: adminUser._id.toString(), share: 600 },
          { userId: charlieUser._id.toString(), share: 600 } // Charlie is not a member!
        ]
      })
    });
    assert(invalidParticipantExpRes.status === 400, 'Including non-member in expense participants is rejected (HTTP 400)');

    // 4. Sole Admin cannot be removed from trip
    const removeSoleAdminRes = await fetch(`${baseUrl}/api/trips/${tripId}/members/${adminMember._id.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(removeSoleAdminRes.status === 400, 'Removing the sole administrator of a trip is blocked (HTTP 400)');

    // 5. Sole Admin cannot demote themselves to MEMBER
    const demoteSoleAdminRes = await fetch(`${baseUrl}/api/trips/${tripId}/members/${adminMember._id.toString()}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'MEMBER' })
    });
    assert(demoteSoleAdminRes.status === 400, 'Demoting the sole administrator to MEMBER is blocked (HTTP 400)');

    // 6. Direct status: 'CLOSED' bypass via PATCH /api/trips/:id is blocked
    const directCloseRes = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert(directCloseRes.status === 400, 'Directly forcing status: "CLOSED" via PATCH is blocked (HTTP 400)');

    // 7. Non-creator/non-admin cannot delete booking
    const bookingDoc = await Booking.create({
      tripId: testTrip._id,
      type: 'FLIGHT',
      provider: 'IndiGo Airlines',
      date: new Date('2026-11-01'),
      cost: 6500,
      createdBy: adminUser._id
    });
    const deleteBookingBobRes = await fetch(`${baseUrl}/api/trips/${tripId}/bookings/${bookingDoc._id.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(deleteBookingBobRes.status === 403, 'Non-creator, non-admin member cannot delete booking (HTTP 403)');

    // 8. Non-creator/non-admin cannot delete document
    const documentDoc = await DocumentModel.create({
      tripId: testTrip._id,
      name: 'Passport Scan',
      type: 'ID',
      fileUrl: 'https://tripmate.example.com/passport.pdf',
      uploadedBy: adminUser._id
    });
    const deleteDocBobRes = await fetch(`${baseUrl}/api/trips/${tripId}/documents/${documentDoc._id.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(deleteDocBobRes.status === 403, 'Non-uploader, non-admin member cannot delete document (HTTP 403)');

    // 9. Non-creator/non-admin cannot delete task
    const taskDoc = await Task.create({
      tripId: testTrip._id,
      title: 'Buy snacks',
      createdBy: adminUser._id
    });
    const deleteTaskBobRes = await fetch(`${baseUrl}/api/trips/${tripId}/tasks/${taskDoc._id.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(deleteTaskBobRes.status === 403, 'Non-creator, non-admin member cannot delete task (HTTP 403)');

  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
    testFailed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }

    console.log('\n======================================================');
    console.log(`TripMate Phase 2 Validation Test Results: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log('======================================================\n');

    if (testFailed > 0) {
      process.exit(1);
    }
  }
}

runTests();
