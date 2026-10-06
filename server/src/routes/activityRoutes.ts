import { Router, Response } from 'express';
import { Activity } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';

const router = Router();

// GET /api/trips/:id/activity
router.get('/:id/activity', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const activities = await Activity.find({ tripId })
      .populate('userId', 'name avatar email')
      .sort({ createdAt: 1 }) // Chronological order for chat feed!
      .limit(100);

    res.json({ activities });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching trip activity' });
  }
});

// POST /api/trips/:id/activity (Post a chat message)
router.post('/:id/activity', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { text, message, type, clientMessageId } = req.body;

    const chatText = message || text;
    if (!chatText || !chatText.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const startTime = Date.now();
    const { logActivity } = require('../services/activityService');
    const activity = await logActivity(
      tripId,
      userId,
      type || 'CHAT_MESSAGE',
      chatText.trim(),
      clientMessageId ? { clientMessageId } : undefined
    );

    console.log(`[Backend Chat] Saved activity in ${Date.now() - startTime}ms. ID: ${activity?._id}`);

    res.status(201).json({ activity });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error sending message' });
  }
});

// POST /api/trips/:id/activity/read (Mark messages as read)
router.post('/:id/activity/read', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;

    await Activity.updateMany(
      { tripId, userId: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId }, $set: { status: 'READ' } }
    );

    const { emitToTrip } = require('../sockets/socketHandler');
    emitToTrip(tripId, 'activity.read', { tripId, userId });

    res.json({ message: 'Messages marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error marking messages read' });
  }
});

export default router;
