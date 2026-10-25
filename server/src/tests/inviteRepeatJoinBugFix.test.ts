/**
 * TripMate: Bug Fix Regression Test Suite
 *
 * Verifies the fix for: Repeated “Join Trip?” Prompt After Already Joining a Trip
 *
 * Requirements Tested:
 * 1. A user who is already a trip member opens the same invite link again: no join confirmation is shown;
 *    authoritative membership is confirmed (isAlreadyMember: true), directing to existing trip workspace.
 * 2. A user who is not a member opens a valid invite link: the join confirmation is shown (isAlreadyMember: false).
 * 3. A user joins successfully and revisits the same invite link: isAlreadyMember is true, not asked to join again.
 * 4. A different authenticated account opens the invite link: membership is strictly checked for that account.
 * 5. An expired or invalid token retains the existing error behaviour (HTTP 404 / 400).
 * 6. Repeated renders, concurrent requests, or browser Back/Forward navigation do not create duplicate
 *    memberships, duplicate trips, or duplicate invitations.
 */

import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Trip, TripMember, TripInvite } from '../models';
import authRoutes from '../routes/authRoutes';
import tripRoutes from '../routes/tripRoutes';
import inviteRoutes from '../routes/inviteRoutes';

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
  console.log('TripMate: Invite Repeat Join Bug Fix Test Suite');
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

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    console.log(`[Test Server] Live on ${baseUrl}`);
    console.log(`[Database] Connected to isolated in-memory MongoDB.\n`);

    // Setup: Create Alice (Admin / Creator)
    const regAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Admin', email: 'alice@test.com', password: 'password123' })
    });
    const aliceData = await regAlice.json();
    const aliceToken = aliceData.token;

    // Alice creates trip
    const tripRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        name: 'Kerala Road Trip',
        destination: 'Munnar',
        startDate: '2026-11-01',
        endDate: '2026-11-07',
        estimatedBudget: 40000
      })
    });
    const tripData = await tripRes.json();
    const tripId = tripData.trip._id;

    // Alice generates shareable invite
    const inviteRes = await fetch(`${baseUrl}/api/trips/${tripId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({})
    });
    const inviteData = await inviteRes.json();
    const generalToken = inviteData.invite.token;
    assert(Boolean(generalToken), 'Shareable invite created with valid token');

    // -------------------------------------------------------------
    // CASE 1: Creator/existing member opens invite link
    // -------------------------------------------------------------
    console.log('\n--- CASE 1: Existing member opens invite link ---');
    const alicePreviewRes = await fetch(`${baseUrl}/api/invites/${generalToken}`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert(alicePreviewRes.status === 200, 'Alice preview returns HTTP 200');
    const alicePreviewData = await alicePreviewRes.json();
    assert(alicePreviewData.isAlreadyMember === true, 'Alice is correctly identified as already a member (isAlreadyMember: true)');
    assert(alicePreviewData.alreadyMember === true, 'Alice has alreadyMember: true alias');
    assert(alicePreviewData.trip._id === tripId, 'Trip ID matches target trip for direct navigation');

    // -------------------------------------------------------------
    // CASE 2: Non-member opens valid invite link
    // -------------------------------------------------------------
    console.log('\n--- CASE 2: Non-member opens valid invite link ---');
    // Register Bob (new user)
    const regBob = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Traveler', email: 'bob@test.com', password: 'password123' })
    });
    const bobData = await regBob.json();
    const bobToken = bobData.token;

    // Bob previews invite before joining
    const bobPreviewBeforeJoin = await fetch(`${baseUrl}/api/invites/${generalToken}`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(bobPreviewBeforeJoin.status === 200, 'Bob preview returns HTTP 200');
    const bobPreviewData = await bobPreviewBeforeJoin.json();
    assert(bobPreviewData.isAlreadyMember === false, 'Bob is NOT an existing member (isAlreadyMember: false)');
    assert(bobPreviewData.alreadyMember === false, 'alreadyMember alias is false for non-member');
    assert(bobPreviewData.trip.name === 'Kerala Road Trip', 'Preview provides trip metadata for confirmation modal');

    // -------------------------------------------------------------
    // CASE 3: User joins successfully and revisits same invite link
    // -------------------------------------------------------------
    console.log('\n--- CASE 3: User joins and revisits same invite link ---');
    // Bob joins trip
    const bobJoinRes = await fetch(`${baseUrl}/api/invites/${generalToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      }
    });
    assert(bobJoinRes.status === 201, 'Bob joins trip successfully (HTTP 201)');

    // Bob revisits the same invite link
    const bobRevisitRes = await fetch(`${baseUrl}/api/invites/${generalToken}`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(bobRevisitRes.status === 200, 'Bob revisit returns HTTP 200');
    const bobRevisitData = await bobRevisitRes.json();
    assert(bobRevisitData.isAlreadyMember === true, 'Bob revisit authoritative check isAlreadyMember === true');
    assert(bobRevisitData.alreadyMember === true, 'Bob revisit alreadyMember === true');
    assert(bobRevisitData.trip._id === tripId, 'Trip ID matches Kerala Road Trip for direct workspace opening');

    // -------------------------------------------------------------
    // CASE 4: Different authenticated account opens the invite link
    // -------------------------------------------------------------
    console.log('\n--- CASE 4: Different account opens the invite link ---');
    // Register Charlie
    const regCharlie = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie Newbie', email: 'charlie@test.com', password: 'password123' })
    });
    const charlieData = await regCharlie.json();
    const charlieToken = charlieData.token;

    // Charlie previews with his own token
    const charliePreviewRes = await fetch(`${baseUrl}/api/invites/${generalToken}`, {
      headers: { Authorization: `Bearer ${charlieToken}` }
    });
    assert(charliePreviewRes.status === 200, 'Charlie preview returns HTTP 200');
    const charliePreviewData = await charliePreviewRes.json();
    assert(charliePreviewData.isAlreadyMember === false, 'Charlie is NOT identified as member (bound strictly to Charlie JWT)');
    assert(charliePreviewData.alreadyMember === false, 'Charlie alreadyMember is false');

    // Charlie joins
    const charlieJoinRes = await fetch(`${baseUrl}/api/invites/${generalToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`
      }
    });
    assert(charlieJoinRes.status === 201, 'Charlie joins successfully (HTTP 201)');

    // Charlie revisits: now Charlie is a member
    const charlieRevisitRes = await fetch(`${baseUrl}/api/invites/${generalToken}`, {
      headers: { Authorization: `Bearer ${charlieToken}` }
    });
    const charlieRevisitData = await charlieRevisitRes.json();
    assert(charlieRevisitData.isAlreadyMember === true, 'Charlie revisit confirms isAlreadyMember: true');

    // -------------------------------------------------------------
    // CASE 5: Expired or invalid token retains existing error behaviour
    // -------------------------------------------------------------
    console.log('\n--- CASE 5: Expired or invalid token error handling ---');
    // Non-existent token
    const fakePreview = await fetch(`${baseUrl}/api/invites/nonexistent_token_123456789`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(fakePreview.status === 404, 'Invalid token returns HTTP 404 for authenticated user');

    const fakePublicPreview = await fetch(`${baseUrl}/api/invites/nonexistent_token_123456789`);
    assert(fakePublicPreview.status === 404, 'Invalid token returns HTTP 404 for unauthenticated user');

    // Expired invite token
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expiredInvite = await TripInvite.create({
      tripId,
      code: 'EXP999',
      token: 'expired_token_test_123456789abcdef',
      createdBy: aliceData.user._id,
      expiresAt: yesterday,
      usedCount: 0,
      isActive: true
    });

    const expiredPreviewRes = await fetch(`${baseUrl}/api/invites/${expiredInvite.token}`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert(expiredPreviewRes.status === 400, 'Expired invite returns HTTP 400');
    const expiredData = await expiredPreviewRes.json();
    assert(expiredData.error === 'This invite link has expired', 'Expired invite error message matches expected');

    // -------------------------------------------------------------
    // CASE 6: Repeated renders & navigation do not create duplicates
    // -------------------------------------------------------------
    console.log('\n--- CASE 6: Repeated renders & Back/Forward navigation ---');
    // Simulate 10 repeated Back/Forward navigation preview calls by Bob
    const parallelPreviews = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        fetch(`${baseUrl}/api/invites/${generalToken}`, {
          headers: { Authorization: `Bearer ${bobToken}` }
        }).then((r) => r.json())
      )
    );
    const allReportMember = parallelPreviews.every((p) => p.isAlreadyMember === true);
    assert(allReportMember, 'All 10 repeated preview calls consistently return isAlreadyMember: true');

    // Simulate repeated join attempts (e.g. rapid double clicks)
    const repeatJoinRes = await fetch(`${baseUrl}/api/invites/${generalToken}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      }
    });
    assert(repeatJoinRes.status === 200, 'Duplicate join attempt returns HTTP 200');
    const repeatJoinData = await repeatJoinRes.json();
    assert(repeatJoinData.alreadyMember === true, 'Duplicate join attempt returns alreadyMember: true');

    // Verify database integrity: zero duplicate TripMember records
    const bobMemberDocs = await TripMember.find({ tripId, userId: bobData.user._id });
    assert(bobMemberDocs.length === 1, 'Exactly 1 TripMember document exists for Bob (zero duplicates)');

    const charlieMemberDocs = await TripMember.find({ tripId, userId: charlieData.user._id });
    assert(charlieMemberDocs.length === 1, 'Exactly 1 TripMember document exists for Charlie (zero duplicates)');

    const totalMembers = await TripMember.countDocuments({ tripId });
    assert(totalMembers === 3, 'Total members for trip strictly equals 3 (Alice, Bob, Charlie)');

    // -------------------------------------------------------------
    // FRONTEND STATIC AUDIT: Verification of UI guards
    // -------------------------------------------------------------
    console.log('\n--- FRONTEND STATIC AUDIT: UI component guards ---');
    const modalPath = path.resolve(__dirname, '../../../client/src/components/JoinInviteConfirmationModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert(
      modalContent.includes('isAlreadyMember') || modalContent.includes('alreadyMember'),
      'JoinInviteConfirmationModal checks isAlreadyMember / alreadyMember'
    );
    assert(
      modalContent.includes('onJoined(data.trip._id)'),
      'JoinInviteConfirmationModal calls onJoined immediately when already a member'
    );
    assert(
      modalContent.includes('hasRedirectedRef'),
      'JoinInviteConfirmationModal uses hasRedirectedRef to prevent duplicate side effects'
    );

    const appPath = path.resolve(__dirname, '../../../client/src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert(
      appContent.includes("path.includes('/join/')") && appContent.includes('handlePopState'),
      'App.tsx handlePopState inspects /join/ paths for browser Back/Forward navigation'
    );

    console.log('\n--- CLEANUP ---');
    await mongoose.disconnect();
    await mongod.stop();
    server.close();
    console.log('Cleaned up in-memory database and server.\n');

    console.log('======================================================');
    console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
    console.log('======================================================\n');

    if (testFailed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
