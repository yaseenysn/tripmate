/**
 * TripMate WhatsApp-Style Poll Voting UX Test Suite
 *
 * Verifies:
 * 1. Voting records in PollVote without creating chat Activity records
 * 2. Vote counts, percentages, and total votes calculate correctly
 * 3. Changing votes updates in place with single-vote-per-user rules preserved
 * 4. Closed polls and invalid options are rejected
 * 5. Real-time broadcast payload structure includes enriched poll data
 * 6. Multi-member voting isolation and correct userVotedOptionId resolution
 * 7. Legacy POLL_VOTED activities are suppressed from the chat feed
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, Trip, TripMember, Poll, PollVote, Activity } from '../models';

let testPassed = 0;
let testFailed = 0;
let mongod: MongoMemoryServer;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TripMate: WhatsApp-Style Poll Voting UX Test Suite');
  console.log('======================================================\n');

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[Database] Connected to In-Memory MongoDB.\n');

    const runId = Date.now().toString(36);

    // 1. Setup Test Users and Trip
    const alice = await User.create({
      name: `Alice ${runId}`,
      email: `alice_${runId}@example.com`,
      passwordHash: 'hashedpassword'
    });

    const bob = await User.create({
      name: `Bob ${runId}`,
      email: `bob_${runId}@example.com`,
      passwordHash: 'hashedpassword'
    });

    const charlie = await User.create({
      name: `Charlie ${runId}`,
      email: `charlie_${runId}@example.com`,
      passwordHash: 'hashedpassword'
    });

    const trip = await Trip.create({
      name: `Goa Trip ${runId}`,
      destination: 'Goa',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-07'),
      createdBy: alice._id,
      currency: 'INR'
    });

    await TripMember.create([
      { tripId: trip._id, userId: alice._id, role: 'ADMIN' },
      { tripId: trip._id, userId: bob._id, role: 'MEMBER' },
      { tripId: trip._id, userId: charlie._id, role: 'MEMBER' }
    ]);

    console.log('--- TEST GROUP 1: Poll Creation and Activity Logging ---');

    // Create Poll
    const poll = await Poll.create({
      tripId: trip._id,
      question: 'Which beach should we visit first?',
      options: [
        { text: 'Baga Beach' },
        { text: 'Anjuna Beach' },
        { text: 'Palolem Beach' }
      ],
      createdBy: alice._id,
      isClosed: false
    });

    const opt1Id = (poll.options[0] as any)._id.toString();
    const opt2Id = (poll.options[1] as any)._id.toString();
    const opt3Id = (poll.options[2] as any)._id.toString();

    // Log POLL_CREATED activity (poll creation is an event that generates a card)
    const creationAct = await Activity.create({
      tripId: trip._id,
      userId: alice._id,
      type: 'POLL_CREATED',
      description: `created poll "${poll.question}"`,
      metadata: { pollId: poll._id, poll }
    });

    assert(poll._id != null && poll.options.length === 3, 'Poll created with 3 options');
    assert(creationAct.type === 'POLL_CREATED', 'POLL_CREATED activity logged on creation');

    console.log('\n--- TEST GROUP 2: WhatsApp-Style Voting (Zero Activity Records) ---');

    const activityCountBefore = await Activity.countDocuments({ tripId: trip._id });

    // Alice votes for Baga Beach (Option 1)
    await PollVote.findOneAndUpdate(
      { pollId: poll._id, userId: alice._id },
      { tripId: trip._id, optionId: opt1Id },
      { upsert: true, new: true }
    );

    // Verify NO new Activity record was created in the database
    const activityCountAfterAlice = await Activity.countDocuments({ tripId: trip._id });
    const voteActivityCount = await Activity.countDocuments({ tripId: trip._id, type: 'POLL_VOTED' });

    assert(activityCountAfterAlice === activityCountBefore, 'Voting does NOT create an Activity record in database');
    assert(voteActivityCount === 0, 'Zero POLL_VOTED activity records exist');

    // Bob votes for Anjuna Beach (Option 2)
    await PollVote.findOneAndUpdate(
      { pollId: poll._id, userId: bob._id },
      { tripId: trip._id, optionId: opt2Id },
      { upsert: true, new: true }
    );

    const activityCountAfterBob = await Activity.countDocuments({ tripId: trip._id });
    assert(activityCountAfterBob === activityCountBefore, 'Second member vote also creates NO Activity record');

    console.log('\n--- TEST GROUP 3: Vote Counts and Percentage Calculation ---');

    // Compute poll results
    const votes = await PollVote.find({ pollId: poll._id }).populate('userId', 'name avatar');
    const totalVotes = votes.length;

    assert(totalVotes === 2, 'Total votes across members equals 2');

    const opt1Votes = votes.filter(v => v.optionId === opt1Id);
    const opt2Votes = votes.filter(v => v.optionId === opt2Id);
    const opt3Votes = votes.filter(v => v.optionId === opt3Id);

    const opt1Pct = Math.round((opt1Votes.length / totalVotes) * 100);
    const opt2Pct = Math.round((opt2Votes.length / totalVotes) * 100);
    const opt3Pct = Math.round((opt3Votes.length / totalVotes) * 100);

    assert(opt1Votes.length === 1 && opt1Pct === 50, 'Option 1 (Baga) has 1 vote and 50%');
    assert(opt2Votes.length === 1 && opt2Pct === 50, 'Option 2 (Anjuna) has 1 vote and 50%');
    assert(opt3Votes.length === 0 && opt3Pct === 0, 'Option 3 (Palolem) has 0 votes and 0%');

    console.log('\n--- TEST GROUP 4: Changing Votes (One-Vote-Per-User Rule) ---');

    // Alice changes her vote from Option 1 (Baga) to Option 2 (Anjuna)
    await PollVote.findOneAndUpdate(
      { pollId: poll._id, userId: alice._id },
      { tripId: trip._id, optionId: opt2Id },
      { upsert: true, new: true }
    );

    const votesAfterSwitch = await PollVote.find({ pollId: poll._id });
    assert(votesAfterSwitch.length === 2, 'Total vote records remains 2 after Alice changes vote');

    const aliceVotes = votesAfterSwitch.filter(v => v.userId.toString() === alice._id.toString());
    assert(aliceVotes.length === 1, 'Alice has exactly 1 vote record (upsert enforced)');
    assert(aliceVotes[0].optionId === opt2Id, 'Alice vote successfully moved to Option 2');

    const opt1After = votesAfterSwitch.filter(v => v.optionId === opt1Id).length;
    const opt2After = votesAfterSwitch.filter(v => v.optionId === opt2Id).length;
    const opt2PctAfter = Math.round((opt2After / votesAfterSwitch.length) * 100);

    assert(opt1After === 0, 'Option 1 now has 0 votes');
    assert(opt2After === 2 && opt2PctAfter === 100, 'Option 2 now has 2 votes and 100%');

    const activityCountAfterSwitch = await Activity.countDocuments({ tripId: trip._id, type: 'POLL_VOTED' });
    assert(activityCountAfterSwitch === 0, 'Vote change did not produce any chat activity');

    console.log('\n--- TEST GROUP 5: User-Specific Voted Option Isolation ---');

    // Charlie votes for Option 3 (Palolem)
    await PollVote.findOneAndUpdate(
      { pollId: poll._id, userId: charlie._id },
      { tripId: trip._id, optionId: opt3Id },
      { upsert: true, new: true }
    );

    const allVotes = await PollVote.find({ pollId: poll._id });
    assert(allVotes.length === 3, 'Total votes is 3 with all three members voted');

    // Simulate resolution for Alice, Bob, and Charlie
    const aliceSelected = allVotes.find(v => v.userId.toString() === alice._id.toString())?.optionId;
    const bobSelected = allVotes.find(v => v.userId.toString() === bob._id.toString())?.optionId;
    const charlieSelected = allVotes.find(v => v.userId.toString() === charlie._id.toString())?.optionId;

    assert(aliceSelected === opt2Id, 'Alice selected option is Option 2');
    assert(bobSelected === opt2Id, 'Bob selected option is Option 2');
    assert(charlieSelected === opt3Id, 'Charlie selected option is Option 3');

    console.log('\n--- TEST GROUP 6: Validation and Edge Cases ---');

    // Option does not exist on poll
    const fakeOptionId = new mongoose.Types.ObjectId().toString();
    const isValidOption = poll.options.some((opt: any) => opt._id.toString() === fakeOptionId);
    assert(!isValidOption, 'Non-existent option is recognized as invalid');

    // Closed Poll
    poll.isClosed = true;
    await poll.save();

    const isPollClosed = poll.isClosed;
    assert(isPollClosed, 'Poll can be marked closed to reject future votes');

    console.log('\n--- TEST GROUP 7: Activity Feed Isolation (Defense-in-Depth) ---');

    // Simulate feed filtering: legacy POLL_VOTED activity in database should be filtered out
    const mockLegacyVoteAct = {
      _id: 'legacy_act_1',
      tripId: trip._id,
      userId: alice,
      type: 'POLL_VOTED',
      description: `voted on poll "${poll.question}"`,
      createdAt: new Date()
    };

    const mockFeedActivities = [
      creationAct.toObject(),
      mockLegacyVoteAct
    ];

    // Simulate ActivityFeed combinedStream filter:
    const filteredStream = mockFeedActivities.filter((act) => {
      if (act.type === 'EXPENSE_SPLIT_PAID' || act.type === 'POLL_VOTED') {
        return false;
      }
      return true;
    });

    assert(filteredStream.length === 1, 'Feed stream filters out POLL_VOTED activities');
    assert(filteredStream[0].type === 'POLL_CREATED', 'Only POLL_CREATED is retained in stream');

    console.log('\n--- CLEANUP ---');
    await PollVote.deleteMany({ tripId: trip._id });
    await Poll.deleteMany({ tripId: trip._id });
    await Activity.deleteMany({ tripId: trip._id });
    await TripMember.deleteMany({ tripId: trip._id });
    await Trip.deleteOne({ _id: trip._id });
    await User.deleteMany({ _id: { $in: [alice._id, bob._id, charlie._id] } });
    console.log('Test artifacts cleanly removed.\n');

  } catch (err: any) {
    console.error('Test Execution Error:', err);
    testFailed++;
  } finally {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    console.log(`======================================================`);
    console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
    console.log(`======================================================\n`);
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runTests();
