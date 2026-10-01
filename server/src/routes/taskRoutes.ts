import { Router, Response } from 'express';
import { Task, User } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { emitToTrip } from '../sockets/socketHandler';

const router = Router();

// GET /api/trips/:id/tasks
router.get('/:id/tasks', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const tasks = await Task.find({ tripId })
      .populate('assignedTo', 'name avatar email')
      .populate('createdBy', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching tasks' });
  }
});

// POST /api/trips/:id/tasks
router.post('/:id/tasks', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { title, description, assignedTo, dueDate, priority, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const task = await Task.create({
      tripId,
      title,
      description: description || '',
      assignedTo: assignedTo || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority: priority || 'MEDIUM',
      status: status || 'TODO',
      createdBy: userId
    });

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name avatar email')
      .populate('createdBy', 'name avatar');

    await logActivity(tripId, userId, 'TASK_CREATED', `created task "${title}"`);

    if (assignedTo && assignedTo !== userId) {
      await createNotification(assignedTo, 'New Task Assigned', `You were assigned task "${title}"`, 'TASK', tripId);
    }

    emitToTrip(tripId, 'task.created', populated);

    res.status(201).json({ task: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating task' });
  }
});

// PATCH /api/trips/:id/tasks/:taskId
router.patch('/:id/tasks/:taskId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, taskId } = req.params;
    const task = await Task.findById(taskId);

    if (!task || task.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const oldStatus = task.status;
    const fields = ['title', 'description', 'assignedTo', 'dueDate', 'priority', 'status'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        (task as any)[field] = field === 'dueDate' ? new Date(req.body[field]) : req.body[field];
      }
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name avatar email')
      .populate('createdBy', 'name avatar');

    if (req.body.status && req.body.status !== oldStatus) {
      const msg = req.body.status === 'DONE' ? `completed task "${task.title}"` : `moved task "${task.title}" to ${req.body.status}`;
      await logActivity(tripId, req.user!.userId, 'TASK_UPDATED', msg);
    }

    emitToTrip(tripId, 'task.updated', populated);

    res.json({ task: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating task' });
  }
});

// DELETE /api/trips/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, taskId } = req.params;
    const task = await Task.findById(taskId);

    if (!task || task.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const title = task.title;
    await Task.findByIdAndDelete(taskId);

    await logActivity(tripId, req.user!.userId, 'TASK_DELETED', `deleted task "${title}"`);
    emitToTrip(tripId, 'task.deleted', { taskId });

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting task' });
  }
});

export default router;
