import { Router, Response } from 'express';
import { Poll, PollVote } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips/:id/polls
router.get('/:id/polls', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;

    const polls = await Poll.find({ tripId }).populate('createdBy', 'name avatar').sort({ createdAt: -1 });
    const votes = await PollVote.find({ tripId }).populate('userId', 'name avatar');

    const enrichedPolls = polls.map(poll => {
      const pollVotes = votes.filter(v => v.pollId.toString() === poll._id.toString());
      const totalVotes = pollVotes.length;

      const userVote = pollVotes.find(v => v.userId._id.toString() === userId);
      const userVotedOptionId = userVote ? userVote.optionId : null;

      const optionsWithCount = poll.options.map(opt => {
        const optIdStr = (opt as any)._id.toString();
        const optVotes = pollVotes.filter(v => v.optionId === optIdStr);
        const count = optVotes.length;
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const voters = optVotes.map(v => v.userId);

        return {
          _id: optIdStr,
          text: opt.text,
          voteCount: count,
          percentage,
          voters
        };
      });

      return {
        _id: poll._id,
        question: poll.question,
        options: optionsWithCount,
        createdBy: poll.createdBy,
        isClosed: poll.isClosed,
        createdAt: poll.createdAt,
        totalVotes,
        userVotedOptionId
      };
    });

    res.json({ polls: enrichedPolls });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching polls' });
  }
});

// POST /api/trips/:id/polls
router.post('/:id/polls', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { question, options } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options are required' });
    }

    const poll = await Poll.create({
      tripId,
      question,
      options: options.map(opt => ({ text: typeof opt === 'string' ? opt : opt.text })),
      createdBy: userId,
      isClosed: false
    });

    const populated = await Poll.findById(poll._id).populate('createdBy', 'name avatar');

    await logActivity(
      tripId,
      userId,
      'POLL_CREATED',
      `created poll "${question}"`,
      { pollId: poll._id, poll: populated }
    );
    emitToTrip(tripId, 'poll.created', populated);

    res.status(201).json({ poll: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating poll' });
  }
});

// POST /api/trips/:id/polls/:pollId/vote
router.post('/:id/polls/:pollId/vote', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, pollId } = req.params;
    const userId = req.user!.userId;
    const { optionId } = req.body;

    if (!optionId) {
      return res.status(400).json({ error: 'Option ID is required' });
    }

    const poll = await Poll.findById(pollId);
    if (!poll || poll.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.isClosed) {
      return res.status(400).json({ error: 'This poll is closed' });
    }

    // Validate option exists on poll
    const optionExists = poll.options.some((opt: any) => opt._id.toString() === optionId);
    if (!optionExists) {
      return res.status(400).json({ error: 'Invalid poll option' });
    }

    // Upsert vote (1 vote per user)
    await PollVote.findOneAndUpdate(
      { pollId, userId },
      { tripId, optionId },
      { upsert: true, new: true }
    );

    // Compute updated poll options and vote counts for in-place UI update (like WhatsApp)
    const pollVotes = await PollVote.find({ pollId }).populate('userId', 'name avatar');
    const totalVotes = pollVotes.length;

    const optionsWithCount = poll.options.map((opt: any) => {
      const optIdStr = opt._id.toString();
      const optVotes = pollVotes.filter(v => v.optionId === optIdStr);
      const count = optVotes.length;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const voters = optVotes.map(v => v.userId);

      return {
        _id: optIdStr,
        text: opt.text,
        voteCount: count,
        percentage,
        voters
      };
    });

    const populatedPoll = await Poll.findById(pollId).populate('createdBy', 'name avatar');

    const updatedPoll = {
      _id: poll._id,
      tripId: poll.tripId,
      question: poll.question,
      options: optionsWithCount,
      createdBy: populatedPoll?.createdBy || poll.createdBy,
      isClosed: poll.isClosed,
      createdAt: poll.createdAt,
      totalVotes,
      votes: pollVotes.map(v => ({
        _id: v._id,
        userId: v.userId,
        optionId: v.optionId
      }))
    };

    // Real-time broadcast: update existing poll card in place for all members.
    // Voting is an update to the poll, NOT a new chat message - DO NOT call logActivity.
    emitToTrip(tripId, 'poll.voted', {
      tripId,
      pollId,
      userId,
      optionId,
      poll: updatedPoll
    });

    res.json({
      message: 'Vote recorded successfully',
      poll: {
        ...updatedPoll,
        userVotedOptionId: optionId
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error voting on poll' });
  }
});

export default router;
