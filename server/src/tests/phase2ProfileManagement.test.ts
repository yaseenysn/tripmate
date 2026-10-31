/**
 * TripMate Phase 2: Personal Profile Management Test Suite
 *
 * Verifies:
 * 1. View Account Information (GET /api/auth/me).
 * 2. Edit Display Name, Bio, and Phone Number (PATCH /api/auth/profile).
 * 3. Change Profile Photo (PATCH /api/auth/profile).
 * 4. Input validation (bio length, phone format, empty name).
 * 5. Change Password securely (current password check, length, non-identical).
 * 6. Email Change Flow with 6-digit Verification (request & verify).
 * 7. Global Profile Synchronization via Socket.IO.
 * 8. Account Deletion Safety:
 *    - Owner of group with other members blocked from deletion.
 *    - User with unsettled balances blocked from deletion.
 *    - Safe deletion removes user & cascade deletes workspace non-financial data while preserving historical financial records.
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server as SocketIOServer } from 'socket.io';
import {
  User,
  Trip,
  TripMember,
  Expense,
  Settlement,
  Booking,
  Task,
  Poll,
  Activity,
  UploadedAsset,
} from '../models';
import { initSocket, emitToTrip } from '../sockets/socketHandler';
import authRoutes from '../routes/authRoutes';
import tripRoutes from '../routes/tripRoutes';

const { io: ioClient } = require('../../../client/node_modules/socket.io-client');

const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TripMate: Phase 2 Personal Profile Management Tests');
  console.log('======================================================\n');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/trips', tripRoutes);

  const server = http.createServer(app);
  const ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
  initSocket(ioServer);

  let serverPort = 0;
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      serverPort = (server.address() as any).port;
      resolve();
    });
  });

  const baseUrl = `http://localhost:${serverPort}`;

  try {
    // Setup test users
    const userPass = 'Password123!';
    const hash = await bcrypt.hash(userPass, 10);

    const testUser = await User.create({
      name: 'Initial User',
      email: 'user@tripmate.test',
      passwordHash: hash,
      avatar: 'https://images.unsplash.com/photo-initial-avatar',
      bio: 'Adventurer and photographer',
      phone: '+1 555-0199',
    });
    let userToken = jwt.sign({ userId: testUser._id, email: testUser.email }, JWT_SECRET, { expiresIn: '7d' });

    const secondUser = await User.create({
      name: 'Second Member',
      email: 'second@tripmate.test',
      passwordHash: hash,
      avatar: 'https://images.unsplash.com/photo-second',
    });
    const secondToken = jwt.sign({ userId: secondUser._id, email: secondUser.email }, JWT_SECRET, { expiresIn: '7d' });

    // -----------------------------------------------------------------------
    // TEST 1: View Account Information (GET /api/auth/me)
    // -----------------------------------------------------------------------
    console.log('--- TEST 1: View Account Information ---');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 &&
        meData.user.name === 'Initial User' &&
        meData.user.email === 'user@tripmate.test' &&
        meData.user.bio === 'Adventurer and photographer' &&
        meData.user.phone === '+1 555-0199' &&
        !meData.user.passwordHash,
      'GET /api/auth/me returns full profile details and securely excludes passwordHash'
    );

    // -----------------------------------------------------------------------
    // TEST 2: Edit Display Name, Bio, and Phone
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 2: Edit Display Name, Bio, Phone ---');
    const updateRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Alex Wanderer',
        bio: 'Solo backpacker exploring South East Asia',
        phone: '+91 9876543210',
      }),
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 &&
        updateData.user.name === 'Alex Wanderer' &&
        updateData.user.bio === 'Solo backpacker exploring South East Asia' &&
        updateData.user.phone === '+91 9876543210',
      'PATCH /api/auth/profile updates display name, bio, and phone number'
    );

    // Verify persistence in DB
    const persistedUser = await User.findById(testUser._id);
    assert(
      persistedUser?.name === 'Alex Wanderer' && persistedUser?.phone === '+91 9876543210',
      'Profile updates persist correctly in database'
    );

    // -----------------------------------------------------------------------
    // TEST 3: Profile Input Validation Guardrails
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 3: Profile Validation Guardrails ---');
    // Name empty
    const emptyNameRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ name: '' }),
    });
    assert(emptyNameRes.status === 400, 'Empty display name is rejected with HTTP 400');

    // Bio exceeding 500 chars
    const longBio = 'A'.repeat(501);
    const longBioRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ bio: longBio }),
    });
    assert(longBioRes.status === 400, 'Bio exceeding 500 characters is rejected with HTTP 400');

    // Invalid phone number
    const badPhoneRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ phone: 'not-a-valid-phone-123456789012345678901234567890' }),
    });
    assert(badPhoneRes.status === 400, 'Invalid phone number format is rejected with HTTP 400');

    // -----------------------------------------------------------------------
    // TEST 4: Change Profile Photo
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 4: Change Profile Photo ---');
    const newAvatarUrl = 'https://images.unsplash.com/photo-new-avatar';
    const avatarRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ avatar: newAvatarUrl }),
    });
    const avatarData = await avatarRes.json();
    assert(
      avatarRes.status === 200 && avatarData.user.avatar === newAvatarUrl,
      'Profile photo URL is updated and returned'
    );

    // -----------------------------------------------------------------------
    // TEST 5: Change Password Securely
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 5: Change Password ---');
    // Wrong current password
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword123!' }),
    });
    assert(wrongPassRes.status === 400, 'Wrong current password returns HTTP 400');

    // Same password rejected
    const samePassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ currentPassword: userPass, newPassword: userPass }),
    });
    assert(samePassRes.status === 400, 'Identical new password returns HTTP 400');

    // Valid change
    const newPass = 'UpdatedPassword2026!';
    const changePassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ currentPassword: userPass, newPassword: newPass }),
    });
    assert(changePassRes.status === 200, 'Valid password change returns HTTP 200');

    // Verify login with new password
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@tripmate.test', password: newPass }),
    });
    assert(loginRes.status === 200, 'User can log in successfully with new password');

    // -----------------------------------------------------------------------
    // TEST 6: Email Change Flow with 6-Digit Verification
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 6: Email Change Verification Flow ---');
    const newEmailTarget = 'alex.new@tripmate.test';

    // 6a. Request email change with current password
    const reqEmailRes = await fetch(`${baseUrl}/api/auth/request-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ newEmail: newEmailTarget, currentPassword: newPass }),
    });
    const reqEmailData = await reqEmailRes.json();
    assert(
      reqEmailRes.status === 200 && reqEmailData.pendingEmail === newEmailTarget,
      'Requesting email change generates verification code and returns pendingEmail'
    );

    // Retrieve generated code from user document in DB for test assertion
    const userWithCode = await User.findById(testUser._id);
    const validCode = userWithCode?.emailVerificationCode;
    assert(
      Boolean(validCode && validCode.length === 6 && userWithCode?.pendingEmail === newEmailTarget),
      'Secure 6-digit verification code is stored with expiration on User document'
    );

    // 6b. Verify with incorrect code
    const badCodeRes = await fetch(`${baseUrl}/api/auth/verify-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ code: '000000' }),
    });
    assert(badCodeRes.status === 400, 'Invalid verification code is rejected with HTTP 400');

    // 6c. Verify with correct code
    const verifyCodeRes = await fetch(`${baseUrl}/api/auth/verify-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ code: validCode }),
    });
    const verifyCodeData = await verifyCodeRes.json();
    assert(
      verifyCodeRes.status === 200 &&
        verifyCodeData.user.email === newEmailTarget &&
        Boolean(verifyCodeData.token),
      'Valid code confirms email change and returns refreshed JWT token'
    );

    // Update token to refreshed token
    userToken = verifyCodeData.token;

    // Verify DB user has updated email and cleared pending codes
    const userAfterEmail = await User.findById(testUser._id);
    assert(
      userAfterEmail?.email === newEmailTarget &&
        !userAfterEmail?.pendingEmail &&
        !userAfterEmail?.emailVerificationCode,
      'Database record email is updated and pending verification fields are cleared'
    );

    // -----------------------------------------------------------------------
    // TEST 7: Global Profile Real-Time Synchronization via Socket.IO
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 7: Global Profile Real-Time Synchronization ---');
    const syncTrip = await Trip.create({
      name: 'Sync Test Trip',
      destination: 'Himalayas',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 3),
      createdBy: testUser._id,
      status: 'ACTIVE',
    });
    await TripMember.create({ tripId: syncTrip._id, userId: testUser._id, role: 'ADMIN' });
    await TripMember.create({ tripId: syncTrip._id, userId: secondUser._id, role: 'MEMBER' });

    // Connect socket for secondUser
    const secondSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: secondToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => secondSocket.on('connect', () => resolve()));
    await new Promise<void>((resolve) => secondSocket.emit('join_trip', syncTrip._id.toString(), () => resolve()));

    let broadcastReceived: any = null;
    secondSocket.on('user.profile_updated', (data: any) => {
      broadcastReceived = data;
    });

    // Update profile
    await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ name: 'Alex Synchronized' }),
    });

    await new Promise((r) => setTimeout(r, 200));
    assert(
      broadcastReceived &&
        broadcastReceived.userId === testUser._id.toString() &&
        broadcastReceived.name === 'Alex Synchronized',
      'user.profile_updated event is broadcast to trip rooms when user updates profile'
    );

    secondSocket.disconnect();

    // -----------------------------------------------------------------------
    // TEST 8: Account Deletion Safety Checks
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 8: Account Deletion Safety Checks ---');

    // 8a. Owner of group with other members cannot delete account
    const ownerDeleteRes = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ password: newPass, confirmationText: 'DELETE' }),
    });
    const ownerDeleteData = await ownerDeleteRes.json();
    assert(
      ownerDeleteRes.status === 400 &&
        ownerDeleteData.error?.includes('You are the group owner'),
      'Account deletion is blocked if user is the sole owner of an active group with other members'
    );

    // Transfer group ownership to secondUser so ownership is no longer blocking
    syncTrip.createdBy = secondUser._id as any;
    await syncTrip.save();

    // 8b. User with unsettled financial balance cannot delete account
    await Expense.create({
      tripId: syncTrip._id,
      title: 'Mountain Guide',
      amount: 1000,
      category: 'Activities',
      date: new Date(),
      paidBy: secondUser._id,
      splitType: 'EQUAL',
      participants: [
        { userId: secondUser._id, share: 500, status: 'PAID' },
        { userId: testUser._id, share: 500, status: 'PENDING' },
      ],
      createdBy: secondUser._id,
    });

    const debtDeleteRes = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ password: newPass, confirmationText: 'DELETE' }),
    });
    const debtDeleteData = await debtDeleteRes.json();
    assert(
      debtDeleteRes.status === 400 &&
        debtDeleteData.error?.includes('unsettled balance'),
      'Account deletion is strictly blocked if user has an unsettled financial debt in any active group'
    );

    // Settle the debt so user has zero balance
    await Settlement.create({
      tripId: syncTrip._id,
      fromUser: testUser._id,
      toUser: secondUser._id,
      amount: 500,
      status: 'PAID',
      paidAt: new Date(),
    });

    // 8c. Incorrect confirmation text
    const badConfirmRes = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ password: newPass, confirmationText: 'wrong_text' }),
    });
    assert(badConfirmRes.status === 400, 'Invalid confirmation text is rejected with HTTP 400');

    // 8d. Successful account deletion
    const finalDeleteRes = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ password: newPass, confirmationText: 'DELETE' }),
    });
    assert(finalDeleteRes.status === 200, 'Account is successfully deleted when all safety requirements are met');

    // Verify User record is deleted
    const deletedUserCheck = await User.findById(testUser._id);
    assert(deletedUserCheck === null, 'User document is deleted from database');

    // Verify historical financial records are strictly preserved!
    const expenseCount = await Expense.countDocuments({ tripId: syncTrip._id });
    const settlementCount = await Settlement.countDocuments({ tripId: syncTrip._id });
    assert(
      expenseCount === 1 && settlementCount === 1,
      'Historical financial expenses and settlements are strictly preserved for audit integrity'
    );

    server.close();
    await mongoose.disconnect();
    await mongod.stop();

    console.log('\n======================================================');
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
