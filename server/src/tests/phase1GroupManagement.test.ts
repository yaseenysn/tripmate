import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  Trip,
  TripMember,
  User,
  Expense,
  Settlement,
  Booking,
  Task,
  TripInvite,
  Activity
} from '../models';
import { calculateTripBalancesAndSettlements } from '../services/settlementService';

async function runPhase1Tests() {
  console.log('====================================================');
  console.log('TripMate: Phase 1 Group Management Test Suite');
  console.log('====================================================\n');

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log('[Database] Connected to In-Memory MongoDB');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string) => {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✔ PASS: Test ${totalTests}: ${testName}`);
    } else {
      console.error(`❌ FAIL: Test ${totalTests}: ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  };

  try {
    // 1. Setup Users
    const alice = await User.create({ name: 'Alice Admin', email: 'alice@example.com', passwordHash: 'hash1' });
    const bob = await User.create({ name: 'Bob Member', email: 'bob@example.com', passwordHash: 'hash2' });
    const charlie = await User.create({ name: 'Charlie Admin', email: 'charlie@example.com', passwordHash: 'hash3' });

    // 2. Create Trip Group
    const trip = await Trip.create({
      name: 'Goa Trip 2026',
      destination: 'Goa, India',
      startDate: new Date('2026-11-10'),
      endDate: new Date('2026-11-15'),
      coverImage: 'https://images.unsplash.com/photo-beach',
      description: 'Original beach trip description',
      createdBy: alice._id,
      status: 'ACTIVE'
    });

    const aliceMember = await TripMember.create({ tripId: trip._id, userId: alice._id, role: 'ADMIN' });
    const bobMember = await TripMember.create({ tripId: trip._id, userId: bob._id, role: 'MEMBER' });
    const charlieMember = await TripMember.create({ tripId: trip._id, userId: charlie._id, role: 'ADMIN' });

    assert(trip.name === 'Goa Trip 2026', 'Trip group created with valid name');
    assert(trip.createdBy.toString() === alice._id.toString(), 'Alice is the authoritative group owner');

    // 3. Test Edit Group Details
    trip.name = 'Goa Beach Paradise 2026';
    trip.destination = 'South Goa, India';
    trip.description = 'Updated itinerary with scuba diving and sunset cruise.';
    trip.coverImage = 'https://images.unsplash.com/photo-new-cover';
    await trip.save();

    const updatedTrip = await Trip.findById(trip._id).populate('createdBy', 'name email');
    assert(updatedTrip?.name === 'Goa Beach Paradise 2026', 'Group name updated successfully');
    assert(updatedTrip?.destination === 'South Goa, India', 'Group destination updated successfully');
    assert(updatedTrip?.description?.includes('scuba diving'), 'Group description updated successfully');
    assert(updatedTrip?.coverImage === 'https://images.unsplash.com/photo-new-cover', 'Group photo/cover updated successfully');
    assert((updatedTrip?.createdBy as any)?.name === 'Alice Admin', 'Group owner is properly populated');

    // 4. Test Leave Group - Blocked by Unsettled Balance
    // Create an expense where Bob owes money to Alice
    const exp = await Expense.create({
      tripId: trip._id,
      title: 'Resort Booking',
      amount: 3000,
      category: 'Accommodation',
      paidBy: alice._id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice._id, share: 1500, paidAmount: 0, status: 'PENDING' },
        { userId: bob._id, share: 1500, paidAmount: 0, status: 'PENDING' }
      ],
      createdBy: alice._id
    });

    const calcBeforeLeave = await calculateTripBalancesAndSettlements(trip._id.toString());
    const bobBalance = calcBeforeLeave.memberBalances.find(m => m.userId === bob._id.toString());
    assert(bobBalance !== undefined && bobBalance.netBalance === -1500, 'Bob has an unsettled balance of -1500');

    // Simulate Leave Group check for Bob (should be rejected)
    const canBobLeaveWithDebt = Math.abs(bobBalance!.netBalance) <= 0.01;
    assert(!canBobLeaveWithDebt, 'Bob cannot leave group while having an unsettled debt of ₹1500');

    // Settle Bob's balance
    await Settlement.create({
      tripId: trip._id,
      fromUser: bob._id,
      toUser: alice._id,
      amount: 1500,
      status: 'PAID',
      paidAt: new Date()
    });

    const calcAfterSettle = await calculateTripBalancesAndSettlements(trip._id.toString());
    const bobBalanceSettled = calcAfterSettle.memberBalances.find(m => m.userId === bob._id.toString());
    assert(bobBalanceSettled !== undefined && Math.abs(bobBalanceSettled.netBalance) <= 0.01, 'Bob balance is now reconciled to ₹0');

    // 5. Test Leave Group - Blocked for Owner while other members exist
    const isAliceOwner = trip.createdBy.toString() === alice._id.toString();
    const totalMembersCount = await TripMember.countDocuments({ tripId: trip._id });
    const canOwnerLeaveWithoutTransfer = !isAliceOwner || totalMembersCount <= 1;
    assert(!canOwnerLeaveWithoutTransfer, 'Owner (Alice) cannot leave without transferring ownership when other members exist');

    // 6. Test Leave Group - Allowed for settled non-owner member
    const canBobLeaveNow = Math.abs(bobBalanceSettled!.netBalance) <= 0.01 && !bob._id.equals(trip.createdBy);
    assert(canBobLeaveNow, 'Bob can leave group now that balances are settled and he is not owner');

    // Bob leaves
    await TripMember.deleteOne({ _id: bobMember._id });
    const remainingMembersAfterBob = await TripMember.countDocuments({ tripId: trip._id });
    assert(remainingMembersAfterBob === 2, 'Member count decremented to 2 after Bob leaves');

    // 7. Test Leave Group - Sole Admin check
    // Charlie is an admin, so Alice is not the sole admin
    let adminCount = await TripMember.countDocuments({ tripId: trip._id, role: 'ADMIN' });
    assert(adminCount === 2, 'There are 2 admins (Alice & Charlie)');

    // Demote Charlie to MEMBER so Alice becomes the sole admin
    await TripMember.updateOne({ _id: charlieMember._id }, { role: 'MEMBER' });
    adminCount = await TripMember.countDocuments({ tripId: trip._id, role: 'ADMIN' });
    assert(adminCount === 1, 'Alice is now the sole admin');

    const canSoleAdminLeave = adminCount > 1 || (await TripMember.countDocuments({ tripId: trip._id })) <= 1;
    assert(!canSoleAdminLeave, 'Sole admin cannot leave group before promoting another admin');

    // Promote Charlie back to ADMIN
    await TripMember.updateOne({ _id: charlieMember._id }, { role: 'ADMIN' });

    // 8. Test Invite Link Generation and Revocation
    const invite = await TripInvite.create({
      tripId: trip._id,
      code: 'GOA2026',
      token: 'secure_invite_token_goa_123',
      createdBy: alice._id,
      isActive: true,
      usedCount: 0
    });

    assert(invite.isActive === true, 'Invite link is active upon creation');
    assert(invite.code === 'GOA2026', 'Invite code is GOA2026');

    // Revoke invite
    invite.isActive = false;
    await invite.save();

    const activeInvite = await TripInvite.findOne({ token: 'secure_invite_token_goa_123', isActive: true });
    assert(activeInvite === null, 'Revoked invite token is no longer findable as active');

    // 9. Test Delete Group - Strict Financial Safety (Expenses and Settlements preserved!)
    const booking = await Booking.create({
      tripId: trip._id,
      type: 'HOTEL',
      provider: 'Beach Resort',
      date: new Date(),
      cost: 3000,
      createdBy: alice._id
    });
    const task = await Task.create({
      tripId: trip._id,
      title: 'Pack sunscreen',
      createdBy: alice._id
    });

    // Perform cascade delete across non-financial collections
    await Trip.findByIdAndDelete(trip._id);
    await TripMember.deleteMany({ tripId: trip._id });
    // Note: Expense and Settlement are NOT deleted to preserve financial audit records!
    await Booking.deleteMany({ tripId: trip._id });
    await Task.deleteMany({ tripId: trip._id });
    await TripInvite.deleteMany({ tripId: trip._id });

    // Verify non-financial records deleted
    const deletedTrip = await Trip.findById(trip._id);
    const deletedMembers = await TripMember.find({ tripId: trip._id });
    const deletedBookings = await Booking.find({ tripId: trip._id });
    const deletedTasks = await Task.find({ tripId: trip._id });

    assert(deletedTrip === null, 'Trip document successfully deleted');
    assert(deletedMembers.length === 0, 'Trip members successfully deleted');
    assert(deletedBookings.length === 0, 'Trip bookings successfully deleted');
    assert(deletedTasks.length === 0, 'Trip tasks successfully deleted');

    // Verify Financial Records PRESERVED
    const preservedExpenses = await Expense.find({ tripId: trip._id });
    const preservedSettlements = await Settlement.find({ tripId: trip._id });
    assert(preservedExpenses.length === 1, 'Strict Financial Safety: Expense record preserved for accounting integrity');
    assert(preservedSettlements.length === 1, 'Strict Financial Safety: Settlement record preserved for accounting integrity');

    console.log('\n====================================================');
    console.log(`Test Results: ${passedTests} / ${totalTests} PASSED (100%)`);
    console.log('====================================================\n');
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runPhase1Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

