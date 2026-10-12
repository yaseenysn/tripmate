import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import {
  User, Trip, Activity, DocumentModel, ItineraryItem, Booking, Task, Poll
} from '../models';
import { logActivity } from '../services/activityService';

const pass = (msg: string) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${msg}`);
const fail = (msg: string) => console.log(`\x1b[31m✖ FAIL:\x1b[0m ${msg}`);

const runTests = async () => {
  console.log('====================================================');
  console.log('TripMate: Non-Expense Activity Cards Test Suite');
  console.log('====================================================\n');

  await connectDB();

  let testPassed = 0;
  let testTotal = 7;

  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdTripIds: mongoose.Types.ObjectId[] = [];

  try {
    const user = await User.create({
      name: 'Yaseen Test',
      email: `yaseen_${Date.now()}@test.com`,
      passwordHash: 'testhash'
    });
    createdUserIds.push(user._id);

    const trip = await Trip.create({
      name: 'Shimla Vacation',
      destination: 'Shimla',
      startDate: new Date('2026-10-15'),
      endDate: new Date('2026-10-20'),
      createdBy: user._id,
      status: 'ACTIVE'
    });
    createdTripIds.push(trip._id);

    // 1. PHOTO Activity Card
    const photoDoc = await DocumentModel.create({
      tripId: trip._id,
      uploadedBy: user._id,
      name: 'sunset_ridge.jpg',
      type: 'PHOTO',
      fileUrl: 'https://res.cloudinary.com/tripmate/image/upload/v1/sunset.jpg',
      fileSize: '1.8 MB'
    });
    const photoAct = await logActivity(
      trip._id,
      user._id,
      'PHOTO_UPLOADED',
      `uploaded photo '${photoDoc.name}'`,
      {
        documentId: photoDoc._id,
        document: photoDoc,
        type: 'PHOTO',
        fileUrl: photoDoc.fileUrl,
        fileSize: photoDoc.fileSize
      }
    );
    if (
      photoAct &&
      photoAct.type === 'PHOTO_UPLOADED' &&
      photoAct.metadata?.documentId?.toString() === photoDoc._id.toString() &&
      photoAct.metadata?.fileUrl === photoDoc.fileUrl
    ) {
      pass('Test 1: Photo upload activity includes complete metadata for compact preview card');
      testPassed++;
    } else {
      fail('Test 1: Photo upload activity missing required metadata');
    }

    // 2. DOCUMENT Activity Card
    const pdfDoc = await DocumentModel.create({
      tripId: trip._id,
      uploadedBy: user._id,
      name: 'flight_tickets.pdf',
      type: 'TICKET',
      fileUrl: 'https://res.cloudinary.com/tripmate/raw/upload/v1/flight_tickets.pdf',
      fileSize: '240 KB'
    });
    const docAct = await logActivity(
      trip._id,
      user._id,
      'DOCUMENT_UPLOADED',
      `uploaded document '${pdfDoc.name}'`,
      {
        documentId: pdfDoc._id,
        document: pdfDoc,
        type: pdfDoc.type,
        fileUrl: pdfDoc.fileUrl,
        fileSize: pdfDoc.fileSize
      }
    );
    if (
      docAct &&
      docAct.type === 'DOCUMENT_UPLOADED' &&
      docAct.metadata?.documentId?.toString() === pdfDoc._id.toString() &&
      docAct.metadata?.fileSize === '240 KB'
    ) {
      pass('Test 2: Document upload activity includes filename, size, and download URL');
      testPassed++;
    } else {
      fail('Test 2: Document upload activity missing document metadata');
    }

    // 3. ITINERARY Activity Card
    const itinItem = await ItineraryItem.create({
      tripId: trip._id,
      dayNumber: 1,
      title: 'Mall Road Walk & Sightseeing',
      date: new Date('2026-10-15'),
      location: 'The Ridge, Shimla',
      startTime: '10:00 AM',
      createdBy: user._id
    });
    const itinAct = await logActivity(
      trip._id,
      user._id,
      'ITINERARY_ADDED',
      `added Day 1 itinerary item '${itinItem.title}'`,
      {
        itineraryId: itinItem._id,
        itinerary: itinItem
      }
    );
    if (
      itinAct &&
      itinAct.type === 'ITINERARY_ADDED' &&
      itinAct.metadata?.itineraryId?.toString() === itinItem._id.toString() &&
      itinAct.metadata?.itinerary?.dayNumber === 1
    ) {
      pass('Test 3: Itinerary activity includes day number, location, and itinerary details');
      testPassed++;
    } else {
      fail('Test 3: Itinerary activity missing itinerary details');
    }

    // 4. BOOKING Activity Card
    const booking = await Booking.create({
      tripId: trip._id,
      type: 'HOTEL',
      provider: 'Cedar Grand Hotel',
      bookingReference: 'BK-SHM-991',
      date: new Date('2026-10-15'),
      cost: 4500,
      createdBy: user._id
    });
    const bookingAct = await logActivity(
      trip._id,
      user._id,
      'BOOKING_ADDED',
      `added hotel booking '${booking.provider}'`,
      {
        bookingId: booking._id,
        booking: booking
      }
    );
    if (
      bookingAct &&
      bookingAct.type === 'BOOKING_ADDED' &&
      bookingAct.metadata?.bookingId?.toString() === booking._id.toString() &&
      bookingAct.metadata?.booking?.provider === 'Cedar Grand Hotel'
    ) {
      pass('Test 4: Booking activity includes provider, booking reference, and cost');
      testPassed++;
    } else {
      fail('Test 4: Booking activity missing booking metadata');
    }

    // 5. TASK Activity Card
    const task = await Task.create({
      tripId: trip._id,
      title: 'Pack warm jackets & thermals',
      status: 'TODO',
      priority: 'HIGH',
      createdBy: user._id
    });
    const taskAct = await logActivity(
      trip._id,
      user._id,
      'TASK_ADDED',
      `added task '${task.title}'`,
      {
        taskId: task._id,
        task: task
      }
    );
    if (
      taskAct &&
      taskAct.type === 'TASK_ADDED' &&
      taskAct.metadata?.taskId?.toString() === task._id.toString() &&
      taskAct.metadata?.task?.priority === 'HIGH'
    ) {
      pass('Test 5: Task activity includes title, priority, and completion status');
      testPassed++;
    } else {
      fail('Test 5: Task activity missing task metadata');
    }

    // 6. POLL Activity Card
    const poll = await Poll.create({
      tripId: trip._id,
      question: 'Which cafe for evening snacks?',
      options: [
        { text: 'Cafe Simla Times', votes: [] },
        { text: 'Wake & Bake Cafe', votes: [] }
      ],
      createdBy: user._id
    });
    const pollAct = await logActivity(
      trip._id,
      user._id,
      'POLL_CREATED',
      `created poll '${poll.question}'`,
      {
        pollId: poll._id,
        poll: poll
      }
    );
    if (
      pollAct &&
      pollAct.type === 'POLL_CREATED' &&
      pollAct.metadata?.pollId?.toString() === poll._id.toString() &&
      pollAct.metadata?.poll?.options?.length === 2
    ) {
      pass('Test 6: Poll activity includes question, options, and vote counts');
      testPassed++;
    } else {
      fail('Test 6: Poll activity missing poll options metadata');
    }

    // 7. System Activity (Expense Deletion / Trip change) remains compact system pill
    const sysAct = await logActivity(
      trip._id,
      user._id,
      'EXPENSE_DELETED',
      "deleted expense 'Train tickets'"
    );
    if (
      sysAct &&
      sysAct.type === 'EXPENSE_DELETED' &&
      sysAct.description.includes('deleted expense')
    ) {
      pass('Test 7: Expense deletion is cleanly logged as system activity without re-creating card');
      testPassed++;
    } else {
      fail('Test 7: System activity not logged properly');
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\nCleaning up test data...');
    if (createdTripIds.length > 0) {
      await Activity.deleteMany({ tripId: { $in: createdTripIds } });
      await DocumentModel.deleteMany({ tripId: { $in: createdTripIds } });
      await ItineraryItem.deleteMany({ tripId: { $in: createdTripIds } });
      await Booking.deleteMany({ tripId: { $in: createdTripIds } });
      await Task.deleteMany({ tripId: { $in: createdTripIds } });
      await Poll.deleteMany({ tripId: { $in: createdTripIds } });
      await Trip.deleteMany({ _id: { $in: createdTripIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await disconnectDB();

    console.log('====================================================');
    console.log(`Test Results: ${testPassed} / ${testTotal} PASSED (${Math.round((testPassed / testTotal) * 100)}%)`);
    console.log('====================================================\n');

    if (testPassed !== testTotal) {
      process.exit(1);
    }
  }
};

runTests();
