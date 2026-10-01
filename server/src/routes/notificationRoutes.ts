import { Router, Response } from 'express';
import { Notification } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(30);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.json({ notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching notifications' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: notif });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error marking notification read' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error marking all read' });
  }
});

export default router;
