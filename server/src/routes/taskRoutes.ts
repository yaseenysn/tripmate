import { Router, Response } from 'express';
import { Task, User, TripMember } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { emitToTrip } from '../sockets/socketHandler';
import { isValidObjectId, isSafeString, handleRouteError } from '../utils/validation';

const ALLOWED_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const ALLOWED_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

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
    handleRouteError(error, res, 'Error fetching tasks');
  }
});

// POST /api/trips/:id/tasks
router.post('/:id/tasks', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { title, description, assignedTo, dueDate, priority, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    if (!isSafeString(title, 1, 200)) {
      return res.status(400).json({ error: 'Task title must be between 1 and 200 characters' });
    }

    if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
    }

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }

    if (description && !isSafeString(description, 0, 2000)) {
      return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
    }

    if (dueDate) {
      const d = new Date(dueDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Due date must be a valid date' });
      }
    }

    if (assignedTo) {
      if (!isValidObjectId(assignedTo)) {
        return res.status(400).json({ error: 'Invalid assignedTo user ID format' });
      }
      const isMember = await TripMember.exists({ tripId, userId: assignedTo });
      if (!isMember) {
        return res.status(400).json({ error: 'Assigned user must be an active member of this trip' });
      }
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

    await logActivity(
      tripId,
      userId,
      'TASK_CREATED',
      `created task "${title}"`,
      { taskId: task._id, task: populated }
    );

    if (assignedTo && assignedTo !== userId) {
      await createNotification(assignedTo, 'New Task Assigned', `You were assigned task "${title}"`, 'TASK', tripId);
    }

    emitToTrip(tripId, 'task.created', populated);

    res.status(201).json({ task: populated });
  } catch (error: any) {
    handleRouteError(error, res, 'Error creating task');
  }
});

// PATCH /api/trips/:id/tasks/:taskId
router.patch('/:id/tasks/:taskId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, taskId } = req.params;
    if (!isValidObjectId(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await Task.findById(taskId);

    if (!task || task.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, assignedTo, dueDate, priority, status } = req.body;

    if (title !== undefined && !isSafeString(title, 1, 200)) {
      return res.status(400).json({ error: 'Task title must be between 1 and 200 characters' });
    }

    if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
    }

    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }

    if (description !== undefined && description !== null && !isSafeString(description, 0, 2000)) {
      return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
    }

    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      const d = new Date(dueDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Due date must be a valid date' });
      }
    }

    if (assignedTo) {
      if (!isValidObjectId(assignedTo)) {
        return res.status(400).json({ error: 'Invalid assignedTo user ID format' });
      }
      const isMember = await TripMember.exists({ tripId, userId: assignedTo });
      if (!isMember) {
        return res.status(400).json({ error: 'Assigned user must be an active member of this trip' });
      }
    }

    const oldStatus = task.status;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description || '';
    if (assignedTo !== undefined) task.assignedTo = assignedTo || undefined;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;

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
    handleRouteError(error, res, 'Error updating task');
  }
});

// DELETE /api/trips/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, taskId } = req.params;
    if (!isValidObjectId(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const task = await Task.findById(taskId);

    if (!task || task.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isCreator = task.createdBy.toString() === req.user!.userId;
    const isAdmin = req.tripMember?.role === 'ADMIN';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the task creator or a trip admin can delete this task' });
    }

    const title = task.title;
    await Task.findByIdAndDelete(taskId);

    await logActivity(tripId, req.user!.userId, 'TASK_DELETED', `deleted task "${title}"`);
    emitToTrip(tripId, 'task.deleted', { taskId });

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    handleRouteError(error, res, 'Error deleting task');
  }
});

export default router;
