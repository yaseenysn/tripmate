/**
 * TripMate Phase 2.1 — Independent Security Review Fixes Regression Test Suite
 *
 * Verifies all 7 security review findings:
 * 1. Cloudinary Asset Ownership (indirect IDOR prevention on profile, trip, booking, expense, document).
 * 2. Expense Participant Validation (rejects malformed ObjectIds with 400, checks active trip membership, rounds decimals).
 * 3. Database Error Handling (safe 400s for invalid input, ValidationError, and CastError without stack traces).
 * 4. Closed Trip Safety (closed trip immutable, arbitrary isCorrection bypass removed, 403 returned).
 * 5. Expense Category Consistency (POST and PATCH use shared normalization for lowercase & aliases).
 * 6. Trip Deletion Cascade (safe cleanup across all 13 dependent collections without orphaned records).
 * 7. Settlement Recording Authorization (validates fromUser/toUser ObjectIds and active membership).
 * 8. Malayalam & Unicode Preservation.
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import {
  User,
  Trip,
  TripMember,
  Expense,
  Budget,
  Booking,
  DocumentModel,
  Task,
  ItineraryItem,
  Poll,
  PollVote,
  Activity,
  TripInvite,
  Notification,
  UploadedAsset,
  Settlement
} from '../models';
import { noSqlSanitizerMiddleware } from '../utils/validation';

// Routes
import authRoutes from '../routes/authRoutes';
import tripRoutes from '../routes/tripRoutes';
import expenseRoutes from '../routes/expenseRoutes';
import budgetRoutes from '../routes/budgetRoutes';
import bookingRoutes from '../routes/bookingRoutes';
import documentRoutes from '../routes/documentRoutes';
import taskRoutes from '../routes/taskRoutes';
import itineraryRoutes from '../routes/itineraryRoutes';
import pollRoutes from '../routes/pollRoutes';
import activityRoutes from '../routes/activityRoutes';
import memberRoutes from '../routes/memberRoutes';
import inviteRoutes from '../routes/inviteRoutes';
import settlementRoutes from '../routes/settlementRoutes';
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
  console.log('TripMate: Phase 2.1 Security Review Fixes Test Suite');
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
    app.use('/api/trips', itineraryRoutes);
    app.use('/api/trips', pollRoutes);
    app.use('/api/trips', activityRoutes);
    app.use('/api/trips', settlementRoutes);
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

    // Seed test users
    const alice = await User.create({
      name: 'Alice Explorer',
      email: 'alice@tripmate.test',
      passwordHash: 'HashedPassword123!',
      currency: 'INR'
    });

    const bob = await User.create({
      name: 'Bob Backpacker',
      email: 'bob@tripmate.test',
      passwordHash: 'HashedPassword123!',
      currency: 'INR'
    });

    const charlie = await User.create({
      name: 'Charlie Outsider',
      email: 'charlie@tripmate.test',
      passwordHash: 'HashedPassword123!',
      currency: 'INR'
    });

    const aliceToken = createToken(alice._id.toString(), alice.email);
    const bobToken = createToken(bob._id.toString(), bob.email);
    const charlieToken = createToken(charlie._id.toString(), charlie.email);

    // Seed Alice's uploaded asset in UploadedAsset
    const aliceAssetUrl = 'https://res.cloudinary.com/demo/image/upload/alice_secret_image_123.jpg';
    const aliceAsset = await UploadedAsset.create({
      uploadedBy: alice._id,
      publicId: 'tripmate/user_uploads/alice_secret_image_123',
      folder: 'user_uploads',
      originalName: 'alice_secret_image_123.jpg',
      resourceType: 'image'
    });

    // Create a trip owned by Alice, with Bob as a member
    const trip = await Trip.create({
      name: 'Wayanad Monsoon Trek',
      destination: 'Wayanad, Kerala',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-05'),
      currency: 'INR',
      estimatedBudget: 25000,
      createdBy: alice._id,
      status: 'ACTIVE'
    });

    await TripMember.create([
      { tripId: trip._id, userId: alice._id, role: 'ADMIN' },
      { tripId: trip._id, userId: bob._id, role: 'MEMBER' }
    ]);

    // =========================================================================
    // FINDING 1: CLOUDINARY ASSET OWNERSHIP & IDOR PREVENTION
    // =========================================================================
    console.log('\n--- FINDING 1: CLOUDINARY ASSET OWNERSHIP & IDOR PREVENTION ---');

    // Test 1.1: Bob cannot use Alice's uploaded asset as his profile avatar
    const avatarRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        avatarPublicId: aliceAsset.publicId,
        avatar: aliceAssetUrl
      })
    });
    const avatarJson = await avatarRes.json();
    assert(avatarRes.status === 403, 'Bob cannot use Alice\'s asset for profile avatar (HTTP 403)');
    assert(avatarJson.error.includes('permission') || avatarJson.error.includes('Access denied'), 'Profile avatar IDOR returns safe forbidden error');

    // Test 1.2: Bob cannot create a trip using Alice's uploaded cover image
    const tripCoverRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        name: 'Bob Trip',
        destination: 'Goa',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        coverImagePublicId: aliceAsset.publicId
      })
    });
    assert(tripCoverRes.status === 403, 'Bob cannot create a trip with Alice\'s cover image asset (HTTP 403)');

    // Test 1.3: Bob cannot add a booking with Alice's attachment
    const bookingRes = await fetch(`${baseUrl}/api/trips/${trip._id}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        type: 'HOTEL',
        title: 'Treehouse Stay',
        provider: 'Treehouse Ltd',
        date: '2026-11-02',
        attachmentPublicId: aliceAsset.publicId,
        attachmentUrl: aliceAssetUrl
      })
    });
    assert(bookingRes.status === 403, 'Bob cannot attach Alice\'s asset to a booking (HTTP 403)');

    // Test 1.4: Bob cannot create an expense using Alice's receipt
    const expenseAssetRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Receipt Expense',
        amount: 1500,
        category: 'FOOD',
        paidBy: bob._id.toString(),
        participants: [bob._id.toString()],
        splitType: 'EQUAL',
        receiptPublicId: aliceAsset.publicId
      })
    });
    assert(expenseAssetRes.status === 403, 'Bob cannot attach Alice\'s receipt to an expense (HTTP 403)');

    // Test 1.5: Bob cannot add a document referencing Alice's publicId
    const docAssetRes = await fetch(`${baseUrl}/api/trips/${trip._id}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        name: 'Alice Secret Doc',
        fileUrl: aliceAssetUrl,
        publicId: aliceAsset.publicId
      })
    });
    assert(docAssetRes.status === 403, 'Bob cannot create document pointing to Alice\'s publicId (HTTP 403)');

    // Test 1.6: Alice CAN use her own asset for profile avatar
    const aliceAvatarRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        avatarPublicId: aliceAsset.publicId,
        avatar: aliceAssetUrl
      })
    });
    assert(aliceAvatarRes.status === 200, 'Alice can legitimately use her own asset for profile avatar (HTTP 200)');

    // =========================================================================
    // FINDING 2: EXPENSE PARTICIPANT VALIDATION
    // =========================================================================
    console.log('\n--- FINDING 2: EXPENSE PARTICIPANT VALIDATION ---');

    // Create an expense by Alice
    const createExpRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Campfire Dinner',
        amount: 2400.556, // test rounding
        category: 'FOOD',
        paidBy: alice._id.toString(),
        participants: [alice._id.toString(), bob._id.toString()],
        splitType: 'EQUAL'
      })
    });
    const createExpJson = await createExpRes.json();
    assert(createExpRes.status === 201, 'Alice creates expense (HTTP 201)');
    assert(createExpJson.expense?.amount === 2400.56, `Amount is properly rounded to 2 decimal places: ${createExpJson.expense?.amount} === 2400.56`);
    const expenseId = createExpJson.expense?._id;

    // Test 2.1: Reject malformed participant ObjectId in PATCH
    const patchMalformedRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        participants: ['malformed-id-123', bob._id.toString()]
      })
    });
    assert(patchMalformedRes.status === 400, 'PATCH expense rejects malformed participant ObjectId with HTTP 400');

    // Test 2.2: Reject non-member participant in PATCH
    const patchNonMemberRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        participants: [alice._id.toString(), charlie._id.toString()] // charlie is an outsider
      })
    });
    assert(patchNonMemberRes.status === 400, 'PATCH expense rejects non-trip member participant with HTTP 400');

    // Test 2.3: Valid active members in PATCH succeeds and rounds decimal amount
    const patchValidRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        amount: 3000.778,
        participants: [alice._id.toString(), bob._id.toString()]
      })
    });
    const patchValidJson = await patchValidRes.json();
    assert(patchValidRes.status === 200, 'PATCH expense with valid active members succeeds (HTTP 200)');
    assert(patchValidJson.expense?.amount === 3000.78, `PATCH amount rounds correctly: ${patchValidJson.expense?.amount} === 3000.78`);

    // =========================================================================
    // FINDING 3: DATABASE ERROR HANDLING & CASTERROR / VALIDATIONERROR
    // =========================================================================
    console.log('\n--- FINDING 3: DATABASE ERROR HANDLING ---');

    // Test 3.1: Task creation with invalid dueDate format returns HTTP 400
    const taskInvalidDateRes = await fetch(`${baseUrl}/api/trips/${trip._id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Prepare Trek Gear',
        dueDate: 'invalid-non-date-format'
      })
    });
    assert(taskInvalidDateRes.status === 400, 'Task creation with invalid date returns HTTP 400');

    // Test 3.2: Malformed trip ID in GET /api/trips/:id returns safe HTTP 400 without stack trace
    const castErrorRes = await fetch(`${baseUrl}/api/trips/not-a-valid-object-id`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    const castErrorJson = await castErrorRes.json();
    assert(castErrorRes.status === 400, 'Malformed route param returns HTTP 400 instead of 500');
    assert(!castErrorJson.stack && !JSON.stringify(castErrorJson).includes('Cast to ObjectId failed'), 'No internal Mongoose CastError stack trace is exposed');

    // =========================================================================
    // FINDING 4: CLOSED TRIP SAFETY & IMMUTABILITY
    // =========================================================================
    console.log('\n--- FINDING 4: CLOSED TRIP SAFETY & IMMUTABILITY ---');

    // Close the trip
    trip.status = 'CLOSED';
    await trip.save();

    // Test 4.1: Attempting to modify expense on closed trip with arbitrary isCorrection flag is rejected
    const correctionBypassRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Hacked Closed Trip Expense',
        isCorrection: true,
        correctionReason: 'Arbitrary bypass attempt'
      })
    });
    assert(correctionBypassRes.status === 403, 'isCorrection request flag CANNOT bypass closed trip financial lock (HTTP 403)');

    // Test 4.2: Creating new expense on closed trip is rejected
    const newExpenseClosedRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Post-close expense',
        amount: 500,
        paidBy: alice._id.toString(),
        participants: [alice._id.toString()]
      })
    });
    assert(newExpenseClosedRes.status === 403, 'Creating expense on closed trip is strictly rejected (HTTP 403)');

    // Reopen trip to continue other tests
    trip.status = 'ACTIVE';
    await trip.save();

    // =========================================================================
    // FINDING 5: EXPENSE CATEGORY CONSISTENCY
    // =========================================================================
    console.log('\n--- FINDING 5: EXPENSE CATEGORY CONSISTENCY ---');

    // Test 5.1: POST with lowercase alias 'transport' normalizes to 'TRAVEL'
    const postCategoryRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Jeep Safari',
        amount: 1200,
        category: 'transport', // lowercase alias
        paidBy: alice._id.toString(),
        participants: [alice._id.toString()]
      })
    });
    const postCategoryJson = await postCategoryRes.json();
    assert(postCategoryRes.status === 201, 'POST expense with lowercase alias succeeds (HTTP 201)');
    assert(postCategoryJson.expense?.category === 'Transportation', `Category normalized to Transportation: ${postCategoryJson.expense?.category}`);

    // Test 5.2: PATCH with lowercase alias 'activity' normalizes to 'ACTIVITIES'
    const patchCategoryRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        category: 'activity' // lowercase alias
      })
    });
    const patchCategoryJson = await patchCategoryRes.json();
    assert(patchCategoryRes.status === 200, 'PATCH expense with lowercase alias succeeds (HTTP 200)');
    assert(patchCategoryJson.expense?.category === 'Activities', `Category normalized to Activities in PATCH: ${patchCategoryJson.expense?.category}`);

    // Test 5.3: PATCH with invalid category is rejected with HTTP 400
    const patchInvalidCategoryRes = await fetch(`${baseUrl}/api/trips/${trip._id}/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        category: 'UNRECOGNIZED_CATEGORY'
      })
    });
    assert(patchInvalidCategoryRes.status === 400, 'PATCH expense with invalid category rejected with HTTP 400');

    // =========================================================================
    // FINDING 6: SETTLEMENT RECORDING AUTHORIZATION
    // =========================================================================
    console.log('\n--- FINDING 6: SETTLEMENT RECORDING AUTHORIZATION ---');

    // Test 6.1: Reject non-member fromUser or toUser
    const nonMemberSettlementRes = await fetch(`${baseUrl}/api/trips/${trip._id}/settlements/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        fromUser: charlie._id.toString(), // outsider
        toUser: alice._id.toString(),
        amount: 500,
        paymentMethod: 'UPI'
      })
    });
    assert(nonMemberSettlementRes.status === 400, 'Settlement recording rejects non-member payer with HTTP 400');

    // Test 6.2: Reject malformed fromUser ObjectId
    const malformedSettlementRes = await fetch(`${baseUrl}/api/trips/${trip._id}/settlements/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        fromUser: 'malformed-from-id',
        toUser: alice._id.toString(),
        amount: 500
      })
    });
    assert(malformedSettlementRes.status === 400, 'Settlement recording rejects malformed fromUser ObjectId with HTTP 400');

    // Test 6.3: Valid settlement between active trip members succeeds
    const validSettlementRes = await fetch(`${baseUrl}/api/trips/${trip._id}/settlements/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        fromUser: bob._id.toString(),
        toUser: alice._id.toString(),
        amount: 750,
        paymentMethod: 'CASH',
        notes: 'Dinner split settled'
      })
    });
    assert(validSettlementRes.status === 201, 'Settlement recording between active trip members succeeds (HTTP 201)');

    // =========================================================================
    // FINDING 7: TRIP DELETION CASCADE
    // =========================================================================
    console.log('\n--- FINDING 7: TRIP DELETION CASCADE ---');

    // Populate dependent collections for this trip
    await Budget.create({ tripId: trip._id, category: 'FOOD', allocated: 5000 });
    await Booking.create({ tripId: trip._id, type: 'HOTEL', title: 'Resort Stay', provider: 'Resort Stay Inc', createdBy: alice._id, date: new Date() });
    await DocumentModel.create({ tripId: trip._id, name: 'Permit.pdf', fileUrl: 'https://example.com/permit.pdf', uploadedBy: alice._id });
    await Task.create({ tripId: trip._id, title: 'Pack first aid kit', createdBy: alice._id });
    await ItineraryItem.create({ tripId: trip._id, dayNumber: 1, date: new Date(), title: 'Arrival & Check-in' });
    const poll = await Poll.create({ tripId: trip._id, question: 'Dinner choice?', createdBy: alice._id, options: [{ text: 'Kerala Sadhya' }, { text: 'Barbecue' }] });
    const optId = poll.options[0]._id ? poll.options[0]._id.toString() : 'opt-0';
    await PollVote.create({ pollId: poll._id, tripId: trip._id, userId: alice._id, optionId: optId });
    await Activity.create({ tripId: trip._id, userId: alice._id, type: 'TEST_ACTION', description: 'Test action details' });
    await TripInvite.create({ tripId: trip._id, code: 'TEST99', token: 'cascade_token_123', createdBy: alice._id });
    await Notification.create({ userId: alice._id, tripId: trip._id, title: 'Trip Alert', message: 'Test notification', type: 'TRIP', link: trip._id.toString() });

    // Verify records exist before cascade
    const membersBefore = await TripMember.countDocuments({ tripId: trip._id });
    const expensesBefore = await Expense.countDocuments({ tripId: trip._id });
    const tasksBefore = await Task.countDocuments({ tripId: trip._id });
    const bookingsBefore = await Booking.countDocuments({ tripId: trip._id });
    assert(membersBefore > 0 && expensesBefore > 0 && tasksBefore > 0 && bookingsBefore > 0, 'Dependent records exist before trip deletion');

    // Delete trip as admin (Alice)
    const deleteTripRes = await fetch(`${baseUrl}/api/trips/${trip._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(deleteTripRes.status === 200, 'Trip deleted successfully by admin (HTTP 200)');

    // Verify cascade deletion across all 13 dependent collections
    const membersAfter = await TripMember.countDocuments({ tripId: trip._id });
    const expensesAfter = await Expense.countDocuments({ tripId: trip._id });
    const budgetsAfter = await Budget.countDocuments({ tripId: trip._id });
    const settlementsAfter = await Settlement.countDocuments({ tripId: trip._id });
    const bookingsAfter = await Booking.countDocuments({ tripId: trip._id });
    const docsAfter = await DocumentModel.countDocuments({ tripId: trip._id });
    const tasksAfter = await Task.countDocuments({ tripId: trip._id });
    const itinerariesAfter = await ItineraryItem.countDocuments({ tripId: trip._id });
    const pollsAfter = await Poll.countDocuments({ tripId: trip._id });
    const pollVotesAfter = await PollVote.countDocuments({ pollId: poll._id });
    const activitiesAfter = await Activity.countDocuments({ tripId: trip._id });
    const invitesAfter = await TripInvite.countDocuments({ tripId: trip._id });
    const notificationsAfter = await Notification.countDocuments({ link: trip._id.toString() });

    const totalOrphans = membersAfter + expensesAfter + budgetsAfter + settlementsAfter +
      bookingsAfter + docsAfter + tasksAfter + itinerariesAfter + pollsAfter +
      pollVotesAfter + activitiesAfter + invitesAfter + notificationsAfter;

    assert(totalOrphans === 0, `Cascade cleanup complete: 0 orphaned records across all collections (was ${membersBefore + expensesBefore} items)`);

    // =========================================================================
    // FINDING 8: MALAYALAM & UNICODE PRESERVATION
    // =========================================================================
    console.log('\n--- FINDING 8: MALAYALAM & UNICODE PRESERVATION ---');

    // Create a new trip with Malayalam details
    const mlTrip = await Trip.create({
      name: 'കേരള യാത്ര 2026',
      destination: 'മൂന്നാർ, ഇടുക്കി',
      startDate: new Date('2026-12-10'),
      endDate: new Date('2026-12-15'),
      currency: 'INR',
      estimatedBudget: 15000,
      createdBy: alice._id,
      status: 'ACTIVE'
    });
    await TripMember.create({ tripId: mlTrip._id, userId: alice._id, role: 'ADMIN' });

    const mlExpenseRes = await fetch(`${baseUrl}/api/trips/${mlTrip._id}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'ബോട്ട് സവാരി & ചായ സൽക്കാരം',
        amount: 850,
        category: 'ACTIVITIES',
        paidBy: alice._id.toString(),
        participants: [alice._id.toString()]
      })
    });
    const mlExpenseJson = await mlExpenseRes.json();
    assert(mlExpenseRes.status === 201, 'Malayalam expense created successfully (HTTP 201)');
    assert(mlExpenseJson.expense?.title === 'ബോട്ട് സവാരി & ചായ സൽക്കാരം', `Malayalam text preserved accurately: "${mlExpenseJson.expense?.title}"`);

  } catch (error: any) {
    console.error('[TestSuite Error]', error);
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
    console.log(`Results: ${testPassed} Passed, ${testFailed} Failed`);
    console.log('======================================================\n');
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runTests();
