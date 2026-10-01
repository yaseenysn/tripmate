import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './config/db';
import {
  User, Trip, TripMember, Expense, Budget, ItineraryItem,
  Booking, DocumentModel, Task, Poll, PollVote, Activity, Notification
} from './models';

export const runSeed = async () => {
  console.log('[Seed] Starting database seeding...');

  // 1. Clear existing collection data
  await User.deleteMany({});
  await Trip.deleteMany({});
  await TripMember.deleteMany({});
  await Expense.deleteMany({});
  await Budget.deleteMany({});
  await ItineraryItem.deleteMany({});
  await Booking.deleteMany({});
  await DocumentModel.deleteMany({});
  await Task.deleteMany({});
  await Poll.deleteMany({});
  await PollVote.deleteMany({});
  await Activity.deleteMany({});
  await Notification.deleteMany({});

  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 2. Create Users
  const yaseen = await User.create({
    name: 'Yaseen',
    email: 'yaseen@example.com',
    passwordHash: defaultPasswordHash,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
  });

  const bilal = await User.create({
    name: 'Bilal',
    email: 'bilal@example.com',
    passwordHash: defaultPasswordHash,
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80'
  });

  const amal = await User.create({
    name: 'Amal',
    email: 'amal@example.com',
    passwordHash: defaultPasswordHash,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
  });

  const shafi = await User.create({
    name: 'Shafi',
    email: 'shafi@example.com',
    passwordHash: defaultPasswordHash,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
  });

  console.log(`[Seed] Created ${await User.countDocuments()} users.`);

  // 3. Create Trips
  // A. Lucknow Trip (Active)
  const lucknowTrip = await Trip.create({
    name: 'Lucknow Trip',
    destination: 'Lucknow',
    startDate: new Date('2026-09-30'),
    endDate: new Date('2026-10-05'),
    coverImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    currency: '₹',
    estimatedBudget: 80000,
    description: 'Exploring royal Awadhi architecture, kababs, and heritage sites of Lucknow.',
    createdBy: yaseen._id,
    status: 'ACTIVE'
  });

  // B. Thiruvananthapuram Trip (Upcoming)
  const keralaTrip = await Trip.create({
    name: 'Thiruvananthapuram Trip',
    destination: 'Thiruvananthapuram',
    startDate: new Date('2026-10-12'),
    endDate: new Date('2026-10-15'),
    coverImage: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80',
    currency: '₹',
    estimatedBudget: 35000,
    description: 'Coastal beaches, Kovalam shoreline, Padmanabhaswamy temple and backwaters.',
    createdBy: yaseen._id,
    status: 'UPCOMING'
  });

  // C. Kashmir Trip (Upcoming)
  const kashmirTrip = await Trip.create({
    name: 'Kashmir Trip',
    destination: 'Srinagar & Gulmarg',
    startDate: new Date('2026-12-20'),
    endDate: new Date('2026-12-27'),
    coverImage: 'https://images.unsplash.com/photo-1566837945700-30057527ade0?auto=format&fit=crop&w=800&q=80',
    currency: '₹',
    estimatedBudget: 90000,
    description: 'Winter snow in Gulmarg, shikara rides on Dal Lake and Pahalgam valley.',
    createdBy: yaseen._id,
    status: 'UPCOMING'
  });

  // D. Delhi Trip (Completed)
  const delhiTrip = await Trip.create({
    name: 'Delhi Trip',
    destination: 'New Delhi',
    startDate: new Date('2026-08-10'),
    endDate: new Date('2026-08-13'),
    coverImage: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=800&q=80',
    currency: '₹',
    estimatedBudget: 25000,
    description: 'Historical tour of Qutub Minar, Red Fort and Connaught Place food joints.',
    createdBy: yaseen._id,
    status: 'COMPLETED'
  });

  console.log(`[Seed] Created 4 trips.`);

  // 4. Add Members to Lucknow Trip
  await TripMember.create([
    { tripId: lucknowTrip._id, userId: yaseen._id, role: 'ADMIN' },
    { tripId: lucknowTrip._id, userId: bilal._id, role: 'MEMBER' },
    { tripId: lucknowTrip._id, userId: amal._id, role: 'MEMBER' },
    { tripId: lucknowTrip._id, userId: shafi._id, role: 'MEMBER' },

    { tripId: keralaTrip._id, userId: yaseen._id, role: 'ADMIN' },
    { tripId: keralaTrip._id, userId: bilal._id, role: 'MEMBER' },
    { tripId: keralaTrip._id, userId: amal._id, role: 'MEMBER' },

    { tripId: kashmirTrip._id, userId: yaseen._id, role: 'ADMIN' },
    { tripId: kashmirTrip._id, userId: bilal._id, role: 'MEMBER' },

    { tripId: delhiTrip._id, userId: yaseen._id, role: 'ADMIN' }
  ]);

  // 5. Create Lucknow Trip Budget
  await Budget.create({
    tripId: lucknowTrip._id,
    totalBudget: 80000,
    categoryBudgets: [
      { category: 'Accommodation', plannedAmount: 30000 },
      { category: 'Food', plannedAmount: 20000 },
      { category: 'Transportation', plannedAmount: 18000 },
      { category: 'Activities', plannedAmount: 7000 },
      { category: 'Miscellaneous', plannedAmount: 5000 }
    ]
  });

  // 6. Create Lucknow Expenses
  const lucknowMembers = [yaseen._id, bilal._id, amal._id, shafi._id];
  const equalShares = lucknowMembers.map(uId => ({ userId: uId, share: 3000 }));

  await Expense.create([
    {
      tripId: lucknowTrip._id,
      title: 'Taj Hotel Booking (2 Rooms)',
      amount: 12000,
      category: 'Accommodation',
      date: new Date('2026-09-30'),
      paidBy: bilal._id,
      splitType: 'EQUAL',
      participants: equalShares,
      notes: 'Booked 2 deluxe rooms for 3 nights',
      createdBy: bilal._id
    },
    {
      tripId: lucknowTrip._id,
      title: 'Royal Cafe Tunday Kabab Dinner',
      amount: 2400,
      category: 'Food',
      date: new Date('2026-09-30'),
      paidBy: yaseen._id,
      splitType: 'EQUAL',
      participants: lucknowMembers.map(uId => ({ userId: uId, share: 600 })),
      notes: 'Famous Galouti Kababs and Mughlai Parathas',
      createdBy: yaseen._id
    },
    {
      tripId: lucknowTrip._id,
      title: 'Airport Taxi Transfer to City',
      amount: 850,
      category: 'Local Transport',
      date: new Date('2026-09-30'),
      paidBy: amal._id,
      splitType: 'EQUAL',
      participants: lucknowMembers.map(uId => ({ userId: uId, share: 212.5 })),
      notes: 'Prepaid AC Sedan cab',
      createdBy: amal._id
    },
    {
      tripId: lucknowTrip._id,
      title: 'Bara Imambara Guided Tour & Entry Tickets',
      amount: 1600,
      category: 'Activities',
      date: new Date('2026-10-01'),
      paidBy: yaseen._id,
      splitType: 'EQUAL',
      participants: lucknowMembers.map(uId => ({ userId: uId, share: 400 })),
      createdBy: yaseen._id
    }
  ]);

  // 7. Create Itinerary Items for Lucknow
  await ItineraryItem.create([
    {
      tripId: lucknowTrip._id,
      dayNumber: 1,
      date: new Date('2026-09-30'),
      startTime: '08:30',
      endTime: '10:00',
      title: 'Airport Arrival & Hotel Transfer',
      location: 'Chaudhary Charan Singh International Airport',
      description: 'Land at Lucknow airport and take pre-booked cab to Taj Hotel.',
      estimatedCost: 850,
      assignedMembers: [yaseen._id, bilal._id, amal._id, shafi._id],
      order: 1
    },
    {
      tripId: lucknowTrip._id,
      dayNumber: 1,
      date: new Date('2026-09-30'),
      startTime: '10:00',
      endTime: '12:00',
      title: 'Hotel Check-in & Refreshment',
      location: 'Taj Hotel Lucknow',
      description: 'Check into rooms, unpack and rest before afternoon sightseeing.',
      estimatedCost: 0,
      assignedMembers: [yaseen._id, bilal._id],
      order: 2
    },
    {
      tripId: lucknowTrip._id,
      dayNumber: 1,
      date: new Date('2026-09-30'),
      startTime: '13:00',
      endTime: '14:30',
      title: 'Authentic Lucknowi Lunch',
      location: 'Dastarkhwan, Hazratganj',
      description: 'Taste original Boti Kabab and Biryani in Hazratganj.',
      estimatedCost: 2000,
      assignedMembers: [yaseen._id, bilal._id, amal._id, shafi._id],
      order: 3
    },
    {
      tripId: lucknowTrip._id,
      dayNumber: 1,
      date: new Date('2026-09-30'),
      startTime: '15:00',
      endTime: '18:00',
      title: 'Bara Imambara & Bhulbhulaiya Exploration',
      location: 'Bara Imambara Heritage Complex',
      description: 'Explore the grand 18th-century labyrinth and Rumi Darwaza.',
      estimatedCost: 1600,
      assignedMembers: [yaseen._id, bilal._id, amal._id, shafi._id],
      order: 4
    }
  ]);

  // 8. Bookings
  await Booking.create([
    {
      tripId: lucknowTrip._id,
      type: 'FLIGHT',
      provider: 'IndiGo Airlines',
      bookingReference: 'IND-LKO-9921',
      date: new Date('2026-09-30'),
      time: '06:45 AM',
      location: 'Terminal 2',
      cost: 16000,
      notes: 'Flight 6E-452 from Delhi to Lucknow',
      createdBy: yaseen._id
    },
    {
      tripId: lucknowTrip._id,
      type: 'HOTEL',
      provider: 'Taj Hotel Lucknow',
      bookingReference: 'TAJ-RES-88120',
      date: new Date('2026-09-30'),
      time: '12:00 PM Check-in',
      location: 'Vipin Khand, Gomti Nagar',
      cost: 12000,
      notes: 'Breakfast included for all guests',
      createdBy: bilal._id
    }
  ]);

  // 9. Documents
  await DocumentModel.create([
    {
      tripId: lucknowTrip._id,
      name: 'IndiGo Flight E-Tickets.pdf',
      type: 'TICKET',
      fileUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=400&q=80',
      fileSize: '1.8 MB',
      uploadedBy: yaseen._id
    },
    {
      tripId: lucknowTrip._id,
      name: 'Taj Hotel Confirmation.pdf',
      type: 'CONFIRMATION',
      fileUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80',
      fileSize: '950 KB',
      uploadedBy: bilal._id
    }
  ]);

  // 10. Tasks
  await Task.create([
    {
      tripId: lucknowTrip._id,
      title: 'Book Hotel in Lucknow',
      description: 'Confirm twin deluxe rooms at Taj Gomti Nagar',
      assignedTo: bilal._id,
      dueDate: new Date('2026-09-28'),
      priority: 'HIGH',
      status: 'DONE',
      createdBy: yaseen._id
    },
    {
      tripId: lucknowTrip._id,
      title: 'Arrange Airport Cab Transfer',
      description: 'Book prepaid AC Innova cab from CCS airport to hotel',
      assignedTo: yaseen._id,
      dueDate: new Date('2026-09-29'),
      priority: 'MEDIUM',
      status: 'DONE',
      createdBy: yaseen._id
    },
    {
      tripId: lucknowTrip._id,
      title: 'Confirm Restaurant Reservations',
      description: 'Reserve dinner table at Falak Numa rooftop restaurant for 4 Oct',
      assignedTo: shafi._id,
      dueDate: new Date('2026-10-02'),
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdBy: yaseen._id
    },
    {
      tripId: lucknowTrip._id,
      title: 'Purchase Local Heritage Passes',
      description: 'Buy online tickets for Chota Imambara and British Residency',
      assignedTo: amal._id,
      dueDate: new Date('2026-10-01'),
      priority: 'LOW',
      status: 'TODO',
      createdBy: yaseen._id
    }
  ]);

  // 11. Polls & Votes
  const poll1 = await Poll.create({
    tripId: lucknowTrip._id,
    question: 'Where should we have our Day 2 grand dinner?',
    options: [
      { text: 'Falak Numa Rooftop Restaurant' },
      { text: 'Dastarkhwan Chowk' },
      { text: 'Royal Cafe Hazratganj' }
    ],
    createdBy: yaseen._id,
    isClosed: false
  });

  const opt0 = (poll1.options[0] as any)._id.toString();
  const opt1 = (poll1.options[1] as any)._id.toString();

  await PollVote.create([
    { pollId: poll1._id, tripId: lucknowTrip._id, userId: yaseen._id, optionId: opt0 },
    { pollId: poll1._id, tripId: lucknowTrip._id, userId: bilal._id, optionId: opt0 },
    { pollId: poll1._id, tripId: lucknowTrip._id, userId: amal._id, optionId: opt1 }
  ]);

  // 12. Activity Feed
  await Activity.create([
    {
      tripId: lucknowTrip._id,
      userId: yaseen._id,
      type: 'TRIP_CREATED',
      description: 'Yaseen created the trip "Lucknow Trip".',
      createdAt: new Date('2026-09-25T10:00:00Z')
    },
    {
      tripId: lucknowTrip._id,
      userId: bilal._id,
      type: 'MEMBER_JOINED',
      description: 'Bilal joined the trip.',
      createdAt: new Date('2026-09-25T10:15:00Z')
    },
    {
      tripId: lucknowTrip._id,
      userId: bilal._id,
      type: 'EXPENSE_ADDED',
      description: 'Bilal added ₹12,000 Taj Hotel Booking expense.',
      createdAt: new Date('2026-09-30T09:00:00Z')
    },
    {
      tripId: lucknowTrip._id,
      userId: yaseen._id,
      type: 'EXPENSE_ADDED',
      description: 'Yaseen added ₹2,400 Tunday Kabab Dinner expense.',
      createdAt: new Date('2026-09-30T14:30:00Z')
    },
    {
      tripId: lucknowTrip._id,
      userId: shafi._id,
      type: 'TASK_UPDATED',
      description: 'Shafi started working on "Confirm Restaurant Reservations".',
      createdAt: new Date('2026-09-30T16:00:00Z')
    }
  ]);

  // 13. Notifications
  await Notification.create([
    {
      userId: yaseen._id,
      tripId: lucknowTrip._id,
      title: 'New Expense Added',
      message: 'Bilal added ₹12,000 Taj Hotel Booking expense to Lucknow Trip.',
      type: 'EXPENSE',
      isRead: false
    },
    {
      userId: yaseen._id,
      tripId: lucknowTrip._id,
      title: 'Poll Vote Received',
      message: 'Amal voted on poll "Where should we have our Day 2 grand dinner?".',
      type: 'POLL',
      isRead: false
    }
  ]);

  console.log('[Seed] Seeding completed successfully!');
};

if (require.main === module) {
  connectDB()
    .then(() => runSeed())
    .then(() => {
      console.log('[Seed] Finished. Disconnecting DB.');
      return disconnectDB();
    })
    .catch(err => {
      console.error('[Seed] Error seeding database:', err);
      process.exit(1);
    });
}
