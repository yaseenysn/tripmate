import { Router, Response } from 'express';
import { Activity } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { isSafeString, handleRouteError } from '../utils/validation';

const ALLOWED_USER_ACTIVITY_TYPES = ['CHAT_MESSAGE', 'PHOTO_UPLOADED'];

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
    handleRouteError(error, res, 'Error fetching trip activity');
  }
});

// POST /api/trips/:id/activity (Post a chat message)
router.post('/:id/activity', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { text, message, type, clientMessageId } = req.body;

    const chatText = message || text;
    if (!chatText || typeof chatText !== 'string' || !chatText.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!isSafeString(chatText.trim(), 1, 5000)) {
      return res.status(400).json({ error: 'Message must not exceed 5000 characters' });
    }

    const activityType = type || 'CHAT_MESSAGE';
    if (!ALLOWED_USER_ACTIVITY_TYPES.includes(activityType)) {
      return res.status(400).json({ error: `Invalid activity type. Allowed: ${ALLOWED_USER_ACTIVITY_TYPES.join(', ')}` });
    }

    console.log(`[RTCHAT] API_REQUEST_RECEIVED tripId=${tripId} userId=${userId} clientMessageId=${clientMessageId}`);

    const startTime = Date.now();
    const { logActivity } = require('../services/activityService');
    const activity = await logActivity(
      tripId,
      userId,
      activityType,
      chatText.trim(),
      clientMessageId && typeof clientMessageId === 'string' ? { clientMessageId: clientMessageId.slice(0, 100) } : undefined
    );

    console.log(`[RTCHAT] API_RESPONSE_PREPARED activityId=${activity?._id} in ${Date.now() - startTime}ms`);

    res.status(201).json({ activity });
  } catch (error: any) {
    handleRouteError(error, res, 'Error sending message');
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
    handleRouteError(error, res, 'Error marking messages read');
  }
});

export default router;
