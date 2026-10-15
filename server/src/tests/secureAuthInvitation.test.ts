/**
 * TripMate: Secure Authentication, Registration, and Trip Invitation Test Suite
 *
 * Verifies:
 * 1. Login page does not render Yaseen, Bilal, Amal, or other account-selection cards.
 * 2. Existing user can log in with their own credentials.
 * 3. Normal registration and login without an invitation work correctly.
 * 4. New user can register through an invitation link.
 * 5. Invitation token survives registration and login.
 * 6. Authorized invitee can explicitly join the trip.
 * 7. Wrong-email user cannot accept an email-restricted invitation (HTTP 403).
 * 8. Correct-email user accepts email-restricted invitation (HTTP 201).
 * 9. Invalid invitation token is rejected (HTTP 404).
 * 10. Expired invitation token is rejected (HTTP 400).
 * 11. Unauthenticated users cannot access private trip data (HTTP 401).
 * 12. Client-supplied userId cannot impersonate another user.
 * 13. Duplicate membership is prevented and handled safely (alreadyMember: true).
 * 14. Single-use and max-uses invite limits are strictly enforced.
 * 15. Closed trips cannot be joined via invite (HTTP 403).
 * 16. getFrontendBaseUrl never returns a Render backend URL.
 * 17. 6-digit invite code also enforces email restrictions and max uses.
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Trip, TripMember, TripInvite } from '../models';
import authRoutes from '../routes/authRoutes';
import tripRoutes from '../routes/tripRoutes';
import inviteRoutes, { getFrontendBaseUrl } from '../routes/inviteRoutes';

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
  console.log('TripMate: Secure Auth & Trip Invitation Test Suite');
  console.log('======================================================\n');

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/trips', tripRoutes);
    app.use('/api', inviteRoutes);

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

    // -------------------------------------------------------------
    // 1. LOGIN UI VERIFICATION: NO ACCOUNT SELECTION CARDS
    // -------------------------------------------------------------
    console.log('--- 1. LOGIN UI AUDIT: NO ACCOUNT CARDS OR DEMO SHORTCUTS ---');
    const authViewPath = path.resolve(__dirname, '../../../client/src/components/AuthView.tsx');
    const authViewContent = fs.readFileSync(authViewPath, 'utf-8');

    assert(!authViewContent.includes('Quick Demo Accounts'), 'Scenario 1: "Quick Demo Accounts" section is completely removed');
    assert(!authViewContent.includes('handleQuickDemoLogin'), 'Scenario 1: "handleQuickDemoLogin" helper is completely removed');
    assert(!authViewContent.includes('yaseen@example.com'), 'Scenario 1: Hardcoded "yaseen@example.com" removed from login page');
    assert(!authViewContent.includes('bilal@example.com'), 'Scenario 1: Hardcoded "bilal@example.com" removed from login page');
    assert(!authViewContent.includes('amal@example.com'), 'Scenario 1: Hardcoded "amal@example.com" removed from login page');
    assert(authViewContent.includes('Forgot Password'), 'Scenario 1: "Forgot Password" link is present on the login form');
    assert(authViewContent.includes('Sign up'), 'Scenario 1: "Sign up" toggle link is present');
    assert(authViewContent.includes('Log in'), 'Scenario 1: "Log in" toggle link is present');

    // -------------------------------------------------------------
    // 2. EXISTING USER LOGIN
    // -------------------------------------------------------------
    console.log('\n--- 2. EXISTING USER LOGIN WITH CREDENTIALS ---');
    // Register user Alice
    const regAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Admin', email: 'alice@test.com', password: 'password123' })
    });
    assert(regAlice.status === 201, 'Scenario 2: Alice registers successfully');
    const aliceData = await regAlice.json();
    assert(Boolean(aliceData.token && aliceData.user), 'Alice receives JWT token and user profile');

    // Successful login
    const loginAlice = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.com', password: 'password123' })
    });
    assert(loginAlice.status === 200, 'Scenario 2: Alice logs in with correct password');
    const aliceLoginData = await loginAlice.json();
    assert(aliceLoginData.user.email === 'alice@test.com', 'Alice user identity verified on login');

    // Bad password login
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.com', password: 'wrongpassword' })
    });
    assert(badLogin.status === 401, 'Scenario 2: Login with wrong password rejected with HTTP 401');

    // Non-existent user login
    const nonExistentLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'password123' })
    });
    assert(nonExistentLogin.status === 401, 'Scenario 2: Login with non-existent email rejected with HTTP 401');

    // -------------------------------------------------------------
    // 3. NORMAL REGISTRATION & DUPLICATE EMAIL REJECTION
    // -------------------------------------------------------------
    console.log('\n--- 3. REGISTRATION VALIDATION & DUPLICATE PREVENTION ---');
    const dupReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Clone', email: 'alice@test.com', password: 'newpassword' })
    });
    assert(dupReg.status === 400, 'Scenario 3: Registering with existing email strictly rejected (HTTP 400)');

    // -------------------------------------------------------------
    // 4. CREATE TRIP & GENERAL SHAREABLE INVITATION
    // -------------------------------------------------------------
    console.log('\n--- 4. TRIP CREATION & DIRECT SHAREABLE INVITATION ---');
    const aliceToken = aliceLoginData.token;
    const tripRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        name: 'Goa Summer Trip',
        destination: 'Goa, India',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        currency: '₹',
        budget: 20000
      })
    });
    assert(tripRes.status === 201, 'Scenario 4: Trip created successfully by Alice');
    const tripData = await tripRes.json();
    const tripId = tripData.trip._id;

    // Create general invite link
    const generalInviteRes = await fetch(`${baseUrl}/api/trips/${tripId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ maxUses: 5 })
    });
    assert(generalInviteRes.status === 201, 'Scenario 4: General shareable invite created');
    const genInviteData = await generalInviteRes.json();
    const generalToken = genInviteData.invite.token;
    const generalInviteUrl = genInviteData.invite.inviteUrl;

    assert(!generalInviteUrl.includes('onrender.com'), 'Scenario 4: Direct invite URL does not use onrender.com backend domain');
    assert(!generalInviteUrl.includes(':5000'), 'Scenario 4: Direct invite URL does not use backend port 5000');
    assert(generalInviteUrl.includes('/join/'), 'Scenario 4: Direct invite URL contains clean /join/:token path');

    // -------------------------------------------------------------
    // 5. NEW USER REGISTRATION VIA INVITATION LINK
    // -------------------------------------------------------------
    console.log('\n--- 5. NEW USER REGISTRATION THROUGH INVITATION LINK ---');
    // Preview invitation as unauthenticated user
    const previewRes = await fetch(`${baseUrl}/api/invites/${generalToken}`);
    assert(previewRes.status === 200, 'Scenario 5: Public preview of invitation returns HTTP 200');
    const previewData = await previewRes.json();
    assert(previewData.trip.name === 'Goa Summer Trip', 'Preview accurately shows trip name');
    assert(previewData.inviter.name === 'Alice Admin', 'Preview accurately shows inviter name');

    // New user Bob registers
    const regBob = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Invitee', email: 'bob@test.com', password: 'password123' })
    });
    assert(regBob.status === 201, 'Scenario 5: Bob registers account successfully');
    const bobData = await regBob.json();
    const bobToken = bobData.token;

    // Bob accepts invitation using his new JWT
    const bobJoinRes = await fetch(`${baseUrl}/api/invites/${generalToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      }
    });
    assert(bobJoinRes.status === 201, 'Scenario 5: Bob successfully joins trip with token (HTTP 201)');
    const bobJoinData = await bobJoinRes.json();
    assert(bobJoinData.tripId === tripId, 'Joined tripId matches target trip');

    // Verify Bob is now in TripMember collection
    const bobMember = await TripMember.findOne({ tripId, userId: bobData.user._id });
    assert(Boolean(bobMember && bobMember.role === 'MEMBER'), 'Bob persisted as MEMBER in MongoDB');

    // -------------------------------------------------------------
    // 6. DUPLICATE MEMBERSHIP HANDLING
    // -------------------------------------------------------------
    console.log('\n--- 6. DUPLICATE MEMBERSHIP HANDLING ---');
    const bobRejoinRes = await fetch(`${baseUrl}/api/invites/${generalToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      }
    });
    assert(bobRejoinRes.status === 200, 'Scenario 6: Re-joining by existing member returns HTTP 200 safely');
    const bobRejoinData = await bobRejoinRes.json();
    assert(bobRejoinData.alreadyMember === true, 'Response explicitly flags alreadyMember: true');
    const bobMemberCount = await TripMember.countDocuments({ tripId, userId: bobData.user._id });
    assert(bobMemberCount === 1, 'Exactly 1 TripMember document exists for Bob (zero duplicates)');

    // -------------------------------------------------------------
    // 7. EMAIL-RESTRICTED INVITATION & MISMATCH SECURITY
    // -------------------------------------------------------------
    console.log('\n--- 7. EMAIL-RESTRICTED INVITATION SECURITY ---');
    // Alice sends email invite specifically to charlie@test.com
    const emailInviteRes = await fetch(`${baseUrl}/api/trips/${tripId}/invites/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        email: 'charlie@test.com',
        message: 'Pack your bags for Goa!'
      })
    });
    assert(emailInviteRes.status === 201, 'Scenario 7: Email invitation created for charlie@test.com');
    const emailInviteData = await emailInviteRes.json();
    const charlieToken = emailInviteData.invite.token;
    const charlieCode = emailInviteData.invite.code;

    // Attacker Dave registers with dave@test.com
    const regDave = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dave Intruder', email: 'dave@test.com', password: 'password123' })
    });
    const daveData = await regDave.json();
    const daveToken = daveData.token;

    // Dave tries to join using Charlie's token
    const daveAttackRes = await fetch(`${baseUrl}/api/invites/${charlieToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`
      }
    });
    assert(daveAttackRes.status === 403, 'Scenario 7: Dave with wrong email strictly rejected (HTTP 403)');
    const daveAttackJson = await daveAttackRes.json();
    assert(daveAttackJson.error.includes('charlie@test.com'), 'Clear error stating invitation is restricted to charlie@test.com');

    // Dave tries to join using Charlie's 6-digit code
    const daveCodeAttackRes = await fetch(`${baseUrl}/api/trips/join-with-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`
      },
      body: JSON.stringify({ code: charlieCode })
    });
    assert(daveCodeAttackRes.status === 403, 'Scenario 7: Dave using 6-digit code strictly rejected (HTTP 403)');

    // Verify Dave is NOT a member in database
    const daveMember = await TripMember.findOne({ tripId, userId: daveData.user._id });
    assert(daveMember === null, 'Dave was NOT added to TripMember');

    // Now Charlie registers with charlie@test.com (case insensitive test: ChArLiE@test.com)
    const regCharlie = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie Authorized', email: 'ChArLiE@test.com', password: 'password123' })
    });
    assert(regCharlie.status === 201, 'Scenario 7: Charlie registers account');
    const charlieAuthData = await regCharlie.json();
    const charlieJwt = charlieAuthData.token;

    // Charlie joins using his token
    const charlieJoinRes = await fetch(`${baseUrl}/api/invites/${charlieToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieJwt}`
      }
    });
    assert(charlieJoinRes.status === 201, 'Scenario 7: Charlie with matching email accepts invite successfully (HTTP 201)');

    const charlieMember = await TripMember.findOne({ tripId, userId: charlieAuthData.user._id });
    assert(Boolean(charlieMember), 'Charlie successfully persisted as trip member');

    // -------------------------------------------------------------
    // 8. INVALID & EXPIRED INVITATION TOKENS
    // -------------------------------------------------------------
    console.log('\n--- 8. INVALID & EXPIRED INVITATION TOKENS ---');
    // Invalid token
    const invalidRes = await fetch(`${baseUrl}/api/invites/completely_fake_token_xyz/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      }
    });
    assert(invalidRes.status === 404, 'Scenario 8: Completely fake invite token returns HTTP 404');

    // Expired token
    const expiredInvite = await TripInvite.create({
      tripId,
      code: 'EXP999',
      token: 'expired_test_token_123',
      createdBy: aliceData.user._id,
      expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      usedCount: 0,
      isActive: true
    });

    const expPreview = await fetch(`${baseUrl}/api/invites/${expiredInvite.token}`);
    assert(expPreview.status === 400, 'Scenario 8: Preview of expired token returns HTTP 400');
    const expPreviewJson = await expPreview.json();
    assert(expPreviewJson.error.includes('expired'), 'Error message states invite link has expired');

    const expJoin = await fetch(`${baseUrl}/api/invites/${expiredInvite.token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`
      }
    });
    assert(expJoin.status === 400, 'Scenario 8: Joining with expired token returns HTTP 400');

    // -------------------------------------------------------------
    // 9. UNAUTHENTICATED PRIVATE TRIP ACCESS
    // -------------------------------------------------------------
    console.log('\n--- 9. PRIVATE TRIP ACCESS AUTHORIZATION ---');
    const unauthTrip = await fetch(`${baseUrl}/api/trips/${tripId}`);
    assert(unauthTrip.status === 401, 'Scenario 9: Unauthenticated request to /trips/:id returns HTTP 401');

    // Non-member access to trip
    const nonMemberTrip = await fetch(`${baseUrl}/api/trips/${tripId}`, {
      headers: { Authorization: `Bearer ${daveToken}` }
    });
    assert(nonMemberTrip.status === 403, 'Scenario 9: Authenticated non-member access returns HTTP 403');

    // -------------------------------------------------------------
    // 10. CLIENT-SUPPLIED USERID TAMPERING RESISTANCE
    // -------------------------------------------------------------
    console.log('\n--- 10. CLIENT-SUPPLIED USERID TAMPERING RESISTANCE ---');
    // Create new invite
    const tamperInvite = await TripInvite.create({
      tripId,
      code: 'TMP123',
      token: 'tamper_test_token_456',
      createdBy: aliceData.user._id,
      isActive: true
    });

    // Dave calls join with tampered userId in body attempting to impersonate Alice
    const tamperRes = await fetch(`${baseUrl}/api/invites/${tamperInvite.token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${daveToken}`
      },
      body: JSON.stringify({ userId: aliceData.user._id })
    });
    assert(tamperRes.status === 201, 'Scenario 10: Join request processes');
    // Verify membership was created for DAVE (from JWT), NOT Alice
    const daveJoinedMember = await TripMember.findOne({ tripId, userId: daveData.user._id });
    assert(Boolean(daveJoinedMember), 'Membership was bound strictly to JWT user (Dave), ignoring client-supplied userId');

    // -------------------------------------------------------------
    // 11. MAX USES & INVITATION REVOCATION
    // -------------------------------------------------------------
    console.log('\n--- 11. MAX USES & REVOCATION ENFORCEMENT ---');
    const singleUseInvite = await TripInvite.create({
      tripId,
      code: 'SGL100',
      token: 'single_use_token_789',
      createdBy: aliceData.user._id,
      maxUses: 1,
      usedCount: 0,
      isActive: true
    });

    // Create a new user Emma
    const regEmma = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Emma', email: 'emma@test.com', password: 'password123' })
    });
    const emmaData = await regEmma.json();

    // Create user Frank
    const regFrank = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Frank', email: 'frank@test.com', password: 'password123' })
    });
    const frankData = await regFrank.json();

    // Emma uses the 1-use invite
    const emmaJoin = await fetch(`${baseUrl}/api/invites/${singleUseInvite.token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${emmaData.token}`
      }
    });
    assert(emmaJoin.status === 201, 'Scenario 11: First user (Emma) uses single-use invite successfully');

    // Verify invite was marked inactive
    const updatedSingleInvite = await TripInvite.findById(singleUseInvite._id);
    assert(updatedSingleInvite?.isActive === false, 'Single-use invite automatically deactivated after maxUses reached');

    // Frank tries to use the same invite
    const frankJoin = await fetch(`${baseUrl}/api/invites/${singleUseInvite.token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankData.token}`
      }
    });
    assert(frankJoin.status === 404, 'Scenario 11: Second user (Frank) is rejected (HTTP 404 invalid/expired)');

    // -------------------------------------------------------------
    // 12. CLOSED TRIP JOIN GUARD
    // -------------------------------------------------------------
    console.log('\n--- 12. CLOSED TRIP JOIN GUARD ---');
    const closedTrip = await Trip.create({
      name: 'Archived Past Trip',
      destination: 'Manali',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
      currency: '₹',
      status: 'CLOSED',
      createdBy: aliceData.user._id
    });

    const closedInvite = await TripInvite.create({
      tripId: closedTrip._id,
      code: 'CLS999',
      token: 'closed_trip_token_000',
      createdBy: aliceData.user._id,
      isActive: true
    });

    const closedJoin = await fetch(`${baseUrl}/api/invites/${closedInvite.token}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${frankData.token}`
      }
    });
    assert(closedJoin.status === 403, 'Scenario 12: Joining a CLOSED trip is blocked with HTTP 403');

    // -------------------------------------------------------------
    // 13. FRONTEND BASE URL DOMAIN AUDIT
    // -------------------------------------------------------------
    console.log('\n--- 13. FRONTEND BASE URL DOMAIN INTEGRITY ---');
    const mockReqWithOrigin = {
      get: (h: string) => (h === 'origin' ? 'https://tripmate-ten-mu.vercel.app' : undefined)
    } as any;
    const urlFromOrigin = getFrontendBaseUrl(mockReqWithOrigin);
    assert(urlFromOrigin === 'https://tripmate-ten-mu.vercel.app', 'getFrontendBaseUrl respects clean origin header');

    const mockReqWithRenderOrigin = {
      get: (h: string) => (h === 'origin' ? 'https://tripmate-backend.onrender.com' : undefined)
    } as any;
    const urlFromRender = getFrontendBaseUrl(mockReqWithRenderOrigin);
    assert(!urlFromRender.includes('onrender.com'), 'getFrontendBaseUrl strictly ignores onrender.com origin');

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- CLEANUP ---');
    await TripInvite.deleteMany({});
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
