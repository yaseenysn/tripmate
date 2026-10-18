/**
 * TripMate Critical Security Hardening Test Suite
 *
 * Verifies Phase 1 Critical Security Fixes:
 * 1. Unauthenticated Socket.IO connections are rejected.
 * 2. Socket.IO connections with invalid tokens are rejected.
 * 3. Authenticated Socket.IO connections succeed.
 * 4. Non-members cannot join private trip rooms.
 * 5. Unauthorized users cannot receive private trip events.
 * 6. Upload filter rejects executable files with image MIME headers (MZ/ELF).
 * 7. Upload filter rejects script/HTML payloads and SVG files.
 * 8. Users cannot delete Cloudinary assets belonging to other users (IDOR check).
 * 9. Unauthorized members cannot mark another pair's settlement as paid (HTTP 403).
 * 10. Non-admin members cannot modify trip budgets (HTTP 403), and negative values are rejected (HTTP 400).
 * 11. Malicious Vercel origins are rejected by CORS while legitimate production and local dev origins are accepted.
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server as SocketIOServer } from 'socket.io';
import { User, Trip, TripMember, Settlement, Budget, UploadedAsset } from '../models';
import { initSocket, emitToTrip } from '../sockets/socketHandler';
import { validateFileBufferContent } from '../routes/uploadRoutes';
import uploadRoutes from '../routes/uploadRoutes';
import settlementRoutes from '../routes/settlementRoutes';
import budgetRoutes from '../routes/budgetRoutes';
import { corsOriginHandler, allowedOrigins } from '../config/cors';

// Import socket.io-client from client node_modules
const { io: ioClient } = require('../../../client/node_modules/socket.io-client');

const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';

let testPassed = 0;
let testFailed = 0;
let mongod: MongoMemoryServer;
let server: http.Server;
let ioServer: SocketIOServer;
let baseUrl = '';
let serverPort = 0;

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
  console.log('TripMate: Phase 1 Critical Security Hardening Test Suite');
  console.log('======================================================\n');

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[Database] Connected to isolated In-Memory MongoDB.\n');

    const app = express();
    app.use(express.json());

    // Mount tested routes
    app.use('/api/upload', uploadRoutes);
    app.use('/api/trips', settlementRoutes);
    app.use('/api/trips', budgetRoutes);

    server = http.createServer(app);
    ioServer = new SocketIOServer(server, {
      cors: { origin: '*' }
    });
    initSocket(ioServer);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        baseUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });

    console.log(`[Test Server] Listening on ${baseUrl}\n`);

    const runId = Date.now().toString(36);

    // --- SETUP TEST DATA ---
    const userAdmin = await User.create({
      name: `Admin_${runId}`,
      email: `admin_${runId}@example.com`,
      passwordHash: 'hash'
    });
    const tokenAdmin = jwt.sign({ userId: userAdmin._id, email: userAdmin.email }, JWT_SECRET);

    const userPayer = await User.create({
      name: `Payer_${runId}`,
      email: `payer_${runId}@example.com`,
      passwordHash: 'hash'
    });
    const tokenPayer = jwt.sign({ userId: userPayer._id, email: userPayer.email }, JWT_SECRET);

    const userReceiver = await User.create({
      name: `Receiver_${runId}`,
      email: `receiver_${runId}@example.com`,
      passwordHash: 'hash'
    });
    const tokenReceiver = jwt.sign({ userId: userReceiver._id, email: userReceiver.email }, JWT_SECRET);

    const userOutsider = await User.create({
      name: `Outsider_${runId}`,
      email: `outsider_${runId}@example.com`,
      passwordHash: 'hash'
    });
    const tokenOutsider = jwt.sign({ userId: userOutsider._id, email: userOutsider.email }, JWT_SECRET);

    const userMemberOnly = await User.create({
      name: `MemberOnly_${runId}`,
      email: `memberonly_${runId}@example.com`,
      passwordHash: 'hash'
    });
    const tokenMemberOnly = jwt.sign({ userId: userMemberOnly._id, email: userMemberOnly.email }, JWT_SECRET);

    // Create Trip
    const trip = await Trip.create({
      name: `Trip_${runId}`,
      destination: 'Lucknow',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 3),
      createdBy: userAdmin._id,
      status: 'ACTIVE'
    });

    // Add Members
    await TripMember.create({ tripId: trip._id, userId: userAdmin._id, role: 'ADMIN' });
    await TripMember.create({ tripId: trip._id, userId: userPayer._id, role: 'MEMBER' });
    await TripMember.create({ tripId: trip._id, userId: userReceiver._id, role: 'MEMBER' });
    await TripMember.create({ tripId: trip._id, userId: userMemberOnly._id, role: 'MEMBER' });
    // userOutsider is NOT added to TripMember!

    // Create Initial Budget
    await Budget.create({
      tripId: trip._id,
      totalBudget: 50000,
      categoryBudgets: [{ category: 'Food', plannedAmount: 15000 }]
    });

    // Create a pending settlement between Payer and Receiver
    const settlement = await Settlement.create({
      tripId: trip._id,
      fromUser: userPayer._id,
      toUser: userReceiver._id,
      amount: 1500,
      status: 'PENDING'
    });

    // ========================================================
    // TEST SECTION 1: SOCKET.IO JWT AUTHENTICATION
    // ========================================================
    console.log('--- TEST SECTION 1: Socket.IO Authentication & Room Security ---');

    // 1. Unauthenticated connection rejected
    const unauthErr = await new Promise<string>((resolve) => {
      const client = ioClient(baseUrl, {
        reconnection: false,
        transports: ['websocket'],
        timeout: 2000
      });
      client.on('connect_error', (err: any) => {
        client.disconnect();
        resolve(err.message);
      });
      client.on('connect', () => {
        client.disconnect();
        resolve('CONNECTED_UNEXPECTEDLY');
      });
    });
    assert(
      unauthErr.includes('Authentication error: Access token required'),
      'Unauthenticated Socket.IO connection is rejected'
    );

    // 2. Invalid token connection rejected
    const invalidTokenErr = await new Promise<string>((resolve) => {
      const client = ioClient(baseUrl, {
        auth: { token: 'invalid.token.here' },
        reconnection: false,
        transports: ['websocket'],
        timeout: 2000
      });
      client.on('connect_error', (err: any) => {
        client.disconnect();
        resolve(err.message);
      });
      client.on('connect', () => {
        client.disconnect();
        resolve('CONNECTED_UNEXPECTEDLY');
      });
    });
    assert(
      invalidTokenErr.includes('Authentication error: Invalid or expired token'),
      'Socket.IO connection with invalid JWT token is rejected'
    );

    // 3. Valid authenticated connection succeeds
    const memberSocket = ioClient(baseUrl, {
      auth: { token: tokenMemberOnly },
      reconnection: false,
      transports: ['websocket']
    });
    await new Promise<void>((resolve) => {
      memberSocket.on('connect', () => resolve());
    });
    assert(memberSocket.connected, 'Authenticated Socket.IO connection succeeds');

    // 4. Non-member socket cannot join private trip room
    const outsiderSocket = ioClient(baseUrl, {
      auth: { token: tokenOutsider },
      reconnection: false,
      transports: ['websocket']
    });
    await new Promise<void>((resolve) => {
      outsiderSocket.on('connect', () => resolve());
    });

    const joinAckOutsider = await new Promise<any>((resolve) => {
      outsiderSocket.emit('join_trip', trip._id.toString(), (ack: any) => {
        resolve(ack);
      });
      outsiderSocket.on('error', (err: any) => {
        resolve(err);
      });
    });
    assert(
      joinAckOutsider?.error?.includes('Access denied: You are not a member of this trip'),
      'Non-member socket is denied from joining private trip room'
    );

    // 5. Authorized member can join private trip room
    const joinAckMember = await new Promise<any>((resolve) => {
      memberSocket.emit('join_trip', trip._id.toString(), (ack: any) => {
        resolve(ack);
      });
    });
    assert(
      joinAckMember?.success === true && joinAckMember?.room === `trip_${trip._id}`,
      'Legitimate trip member successfully joins private trip room'
    );

    // 6. Unauthorized users cannot receive private trip events
    let outsiderReceived = false;
    let memberReceived = false;

    outsiderSocket.on('test.event', () => {
      outsiderReceived = true;
    });
    memberSocket.on('test.event', (data: any) => {
      if (data?.secret === 'confidential_trip_event') {
        memberReceived = true;
      }
    });

    emitToTrip(trip._id.toString(), 'test.event', { secret: 'confidential_trip_event' });
    await new Promise((r) => setTimeout(r, 200));

    assert(memberReceived && !outsiderReceived, 'Private trip event is delivered only to room members, not outsider socket');

    memberSocket.disconnect();
    outsiderSocket.disconnect();

    // ========================================================
    // TEST SECTION 2: FILE UPLOAD CONTENT & EXTENSION VALIDATION
    // ========================================================
    console.log('\n--- TEST SECTION 2: File Upload Content & Extension Validation ---');

    // 7. Executable files disguised with image headers are rejected
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // "MZ" DOS header
    const checkExe = validateFileBufferContent(exeBuffer, 'image/jpeg', 'malicious.jpg');
    assert(
      !checkExe.valid && Boolean(checkExe.reason?.includes('Executable files (MZ/PE) are strictly prohibited')),
      'Upload content validation strictly rejects executable DOS/Windows binaries'
    );

    // 8. Linux ELF binaries are rejected
    const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]); // "\x7fELF"
    const checkElf = validateFileBufferContent(elfBuffer, 'image/png', 'exploit.png');
    assert(
      !checkElf.valid && Boolean(checkElf.reason?.includes('Executable binaries (ELF) are strictly prohibited')),
      'Upload content validation strictly rejects executable ELF binaries'
    );

    // 9. Script tags and HTML payloads are rejected
    const scriptBuffer = Buffer.from('<script>alert("xss")</script>');
    const checkScript = validateFileBufferContent(scriptBuffer, 'image/jpeg', 'script.jpg');
    assert(
      !checkScript.valid && Boolean(checkScript.reason?.includes('HTML, SVG, and script payloads are strictly prohibited')),
      'Upload content validation rejects embedded HTML/script payloads'
    );

    // 10. Valid JPEG magic bytes pass inspection
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const checkJpeg = validateFileBufferContent(validJpegBuffer, 'image/jpeg', 'receipt.jpg');
    assert(checkJpeg.valid, 'Upload content validation accepts authentic JPEG image buffer');

    // 11. Valid PNG magic bytes pass inspection
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const checkPng = validateFileBufferContent(validPngBuffer, 'image/png', 'ticket.png');
    assert(checkPng.valid, 'Upload content validation accepts authentic PNG image buffer');

    // 12. Valid PDF magic bytes pass inspection
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%...\n');
    const checkPdf = validateFileBufferContent(validPdfBuffer, 'application/pdf', 'invoice.pdf');
    assert(checkPdf.valid, 'Upload content validation accepts authentic PDF document buffer');

    // ========================================================
    // TEST SECTION 3: CLOUDINARY ASSET DELETION (IDOR PROTECTION)
    // ========================================================
    console.log('\n--- TEST SECTION 3: Cloudinary Asset Deletion IDOR Protection ---');

    // Record an asset uploaded by userPayer
    const assetPayer = await UploadedAsset.create({
      publicId: `expenses/payer_receipt_${runId}`,
      uploadedBy: userPayer._id,
      folder: 'expenses',
      originalName: 'receipt.jpg',
      resourceType: 'image'
    });

    // Outsider attempts to delete userPayer's asset -> HTTP 403
    const delResOutsider = await fetch(`${baseUrl}/api/upload`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOutsider}`
      },
      body: JSON.stringify({ publicId: assetPayer.publicId, resourceType: 'image' })
    });
    assert(
      delResOutsider.status === 403,
      'Unauthorized user receives HTTP 403 when attempting to delete another user asset'
    );

    // Unauthenticated request -> HTTP 401
    const delResUnauth = await fetch(`${baseUrl}/api/upload`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: assetPayer.publicId, resourceType: 'image' })
    });
    assert(
      delResUnauth.status === 401,
      'Unauthenticated request receives HTTP 401 on asset deletion endpoint'
    );

    // ========================================================
    // TEST SECTION 4: SETTLEMENT PAYMENT AUTHORIZATION
    // ========================================================
    console.log('\n--- TEST SECTION 4: Settlement Payment Authorization ---');

    // Outsider (not a member of the trip) calls pay -> HTTP 403 (from requireTripMembership)
    const payResOutsider = await fetch(
      `${baseUrl}/api/trips/${trip._id}/settlements/${settlement._id}/pay`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOutsider}` }
      }
    );
    assert(
      payResOutsider.status === 403,
      'Non-trip member receives HTTP 403 when attempting to pay settlement'
    );

    // MemberOnly (trip member, but neither payer, payee, nor admin) calls pay -> HTTP 403
    const payResMemberOnly = await fetch(
      `${baseUrl}/api/trips/${trip._id}/settlements/${settlement._id}/pay`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenMemberOnly}` }
      }
    );
    const memberOnlyJson = await payResMemberOnly.json();
    assert(
      payResMemberOnly.status === 403 &&
        memberOnlyJson.error?.includes('Only the payer, receiver, or a trip admin can mark this settlement as paid'),
      'Trip member who is not payer, payee, or admin receives HTTP 403 on settlement pay'
    );

    // Authorized Payer calls pay -> HTTP 200
    const payResPayer = await fetch(
      `${baseUrl}/api/trips/${trip._id}/settlements/${settlement._id}/pay`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenPayer}` }
      }
    );
    assert(payResPayer.status === 200, 'Authorized settlement payer can successfully mark payment as paid');

    // ========================================================
    // TEST SECTION 5: BUDGET UPDATE AUTHORIZATION & BOUNDS
    // ========================================================
    console.log('\n--- TEST SECTION 5: Budget Update Authorization & Range Checks ---');

    // Non-admin member attempts to update budget -> HTTP 403
    const budgetResNonAdmin = await fetch(`${baseUrl}/api/trips/${trip._id}/budget`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenMemberOnly}`
      },
      body: JSON.stringify({ totalBudget: 75000 })
    });
    const nonAdminJson = await budgetResNonAdmin.json();
    assert(
      budgetResNonAdmin.status === 403 &&
        nonAdminJson.error?.includes('Admin privileges required'),
      'Non-admin trip member receives HTTP 403 when attempting to update trip budget'
    );

    // Admin attempts to submit negative total budget -> HTTP 400
    const budgetResNegative = await fetch(`${baseUrl}/api/trips/${trip._id}/budget`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({ totalBudget: -1000 })
    });
    const negativeJson = await budgetResNegative.json();
    assert(
      budgetResNegative.status === 400 &&
        negativeJson.error?.includes('Total budget must be a non-negative number'),
      'Negative total budget value is rejected with HTTP 400 Bad Request'
    );

    // Admin attempts to submit negative category planned amount -> HTTP 400
    const budgetResCatNegative = await fetch(`${baseUrl}/api/trips/${trip._id}/budget`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        categoryBudgets: [{ category: 'Food', plannedAmount: -500 }]
      })
    });
    const catNegJson = await budgetResCatNegative.json();
    assert(
      budgetResCatNegative.status === 400 &&
        catNegJson.error?.includes('must be a non-negative number'),
      'Negative category planned amount is rejected with HTTP 400 Bad Request'
    );

    // Admin submits valid budget -> HTTP 200
    const budgetResValid = await fetch(`${baseUrl}/api/trips/${trip._id}/budget`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        totalBudget: 80000,
        categoryBudgets: [{ category: 'Food', plannedAmount: 20000 }]
      })
    });
    assert(budgetResValid.status === 200, 'Trip admin can successfully update budget with non-negative numbers');

    // ========================================================
    // TEST SECTION 6: CORS EXACT ORIGIN MATCHING
    // ========================================================
    console.log('\n--- TEST SECTION 6: CORS Exact Origin Validation ---');

    // 1. Malicious Vercel origin rejected
    let maliciousAllowed: boolean | null = null;
    corsOriginHandler('https://attacker-app.vercel.app', (err, allow) => {
      maliciousAllowed = !err && allow === true;
    });
    assert(
      maliciousAllowed === false,
      'Malicious unwhitelisted .vercel.app origin is rejected by CORS handler'
    );

    // 2. Legitimate production Vercel frontend accepted
    let prodAllowed: boolean | null = null;
    corsOriginHandler('https://tripmate-ten-mu.vercel.app', (err, allow) => {
      prodAllowed = !err && allow === true;
    });
    assert(
      prodAllowed === true,
      'Legitimate production frontend origin (tripmate-ten-mu.vercel.app) is accepted by CORS handler'
    );

    // 3. Localhost development port accepted
    let localhostAllowed: boolean | null = null;
    corsOriginHandler('http://localhost:3000', (err, allow) => {
      localhostAllowed = !err && allow === true;
    });
    assert(
      localhostAllowed === true,
      'Local development origin (http://localhost:3000) is accepted by CORS handler'
    );

    // 4. 127.0.0.1 development port accepted
    let ipAllowed: boolean | null = null;
    corsOriginHandler('http://127.0.0.1:5173', (err, allow) => {
      ipAllowed = !err && allow === true;
    });
    assert(
      ipAllowed === true,
      'Local development origin (http://127.0.0.1:5173) is accepted by CORS handler'
    );

    // 5. Requests with no origin (curl/mobile/Postman) accepted
    let noOriginAllowed: boolean | null = null;
    corsOriginHandler(undefined, (err, allow) => {
      noOriginAllowed = !err && allow === true;
    });
    assert(
      noOriginAllowed === true,
      'Requests with no Origin header (curl/mobile apps) are accepted by CORS handler'
    );

  } catch (err: any) {
    console.error('Critical Security Test Suite encountered unexpected error:', err);
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
    console.log(`Security Hardening Test Results: ${testPassed} Passed, ${testFailed} Failed`);
    console.log('======================================================\n');

    if (testFailed > 0) {
      process.exit(1);
    }
  }
}

runTests();
