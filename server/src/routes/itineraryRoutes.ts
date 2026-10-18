import { Router, Response } from 'express';
import { ItineraryItem } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';
import { isValidObjectId, isSafeString, isValidNumber, handleRouteError } from '../utils/validation';

const router = Router();

// GET /api/trips/:id/itinerary
router.get('/:id/itinerary', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const items = await ItineraryItem.find({ tripId })
      .populate('assignedMembers', 'name avatar email')
      .sort({ dayNumber: 1, startTime: 1, order: 1 });

    res.json({ items });
  } catch (error: any) {
    handleRouteError(error, res, 'Error fetching itinerary');
  }
});

// POST /api/trips/:id/itinerary
router.post('/:id/itinerary', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { dayNumber, date, startTime, endTime, title, location, description, estimatedCost, assignedMembers, notes } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required for itinerary item' });
    }

    if (!isSafeString(title, 1, 150)) {
      return res.status(400).json({ error: 'Title must be between 1 and 150 characters' });
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: 'Date must be a valid date' });
    }

    if (dayNumber !== undefined && (!isValidNumber(dayNumber, 1) || !Number.isInteger(Number(dayNumber)))) {
      return res.status(400).json({ error: 'Day number must be an integer greater than or equal to 1' });
    }

    if (estimatedCost !== undefined && !isValidNumber(estimatedCost, 0)) {
      return res.status(400).json({ error: 'Estimated cost must be a non-negative number' });
    }

    if (location && !isSafeString(location, 0, 150)) {
      return res.status(400).json({ error: 'Location must not exceed 150 characters' });
    }

    if (description && !isSafeString(description, 0, 2000)) {
      return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
    }

    if (startTime && !isSafeString(startTime, 0, 50)) {
      return res.status(400).json({ error: 'Start time must not exceed 50 characters' });
    }

    if (endTime && !isSafeString(endTime, 0, 50)) {
      return res.status(400).json({ error: 'End time must not exceed 50 characters' });
    }

    if (notes && !isSafeString(notes, 0, 2000)) {
      return res.status(400).json({ error: 'Notes must not exceed 2000 characters' });
    }

    const item = await ItineraryItem.create({
      tripId,
      dayNumber: Number(dayNumber) || 1,
      date: new Date(date),
      startTime: startTime || '10:00',
      endTime: endTime || '',
      title: title.trim(),
      location: location ? location.trim() : '',
      description: description ? description.trim() : '',
      estimatedCost: Number(estimatedCost) || 0,
      assignedMembers: assignedMembers || [],
      notes: notes ? notes.trim() : ''
    });

    const populated = await ItineraryItem.findById(item._id).populate('assignedMembers', 'name avatar email');

    await logActivity(
      tripId,
      userId,
      'ITINERARY_ADDED',
      `added Day ${item.dayNumber} itinerary item "${title}"`,
      { itineraryId: item._id, itinerary: populated }
    );
    emitToTrip(tripId, 'itinerary.created', populated);

    res.status(201).json({ item: populated });
  } catch (error: any) {
    handleRouteError(error, res, 'Error creating itinerary item');
  }
});

// PATCH /api/trips/:id/itinerary/:itemId
router.patch('/:id/itinerary/:itemId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, itemId } = req.params;

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ error: 'Invalid itinerary item ID format' });
    }

    const item = await ItineraryItem.findById(itemId);
    if (!item || item.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    const { dayNumber, date, startTime, endTime, title, location, description, estimatedCost, assignedMembers, notes, order } = req.body;

    if (title !== undefined) {
      if (!isSafeString(title, 1, 150)) {
        return res.status(400).json({ error: 'Title must be between 1 and 150 characters' });
      }
      item.title = title.trim();
    }
    if (dayNumber !== undefined) {
      if (!isValidNumber(dayNumber, 1) || !Number.isInteger(Number(dayNumber))) {
        return res.status(400).json({ error: 'Day number must be an integer greater than or equal to 1' });
      }
      item.dayNumber = Number(dayNumber);
    }
    if (date !== undefined) {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Date must be a valid date' });
      }
      item.date = d;
    }
    if (estimatedCost !== undefined) {
      if (!isValidNumber(estimatedCost, 0)) {
        return res.status(400).json({ error: 'Estimated cost must be a non-negative number' });
      }
      item.estimatedCost = Number(estimatedCost);
    }
    if (location !== undefined) {
      if (location && !isSafeString(location, 0, 150)) {
        return res.status(400).json({ error: 'Location must not exceed 150 characters' });
      }
      item.location = location ? location.trim() : '';
    }
    if (description !== undefined) {
      if (description && !isSafeString(description, 0, 2000)) {
        return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
      }
      item.description = description ? description.trim() : '';
    }
    if (startTime !== undefined) {
      if (startTime && !isSafeString(startTime, 0, 50)) {
        return res.status(400).json({ error: 'Start time must not exceed 50 characters' });
      }
      item.startTime = startTime ? startTime.trim() : '';
    }
    if (endTime !== undefined) {
      if (endTime && !isSafeString(endTime, 0, 50)) {
        return res.status(400).json({ error: 'End time must not exceed 50 characters' });
      }
      item.endTime = endTime ? endTime.trim() : '';
    }
    if (notes !== undefined) {
      if (notes && !isSafeString(notes, 0, 2000)) {
        return res.status(400).json({ error: 'Notes must not exceed 2000 characters' });
      }
      item.notes = notes.trim();
    }
    if (assignedMembers !== undefined) item.assignedMembers = assignedMembers;
    if (order !== undefined) item.order = Number(order) || 0;

    await item.save();
    const populated = await ItineraryItem.findById(item._id).populate('assignedMembers', 'name avatar email');

    await logActivity(tripId, req.user!.userId, 'ITINERARY_UPDATED', `updated itinerary item "${item.title}"`);
    emitToTrip(tripId, 'itinerary.updated', populated);

    res.json({ item: populated });
  } catch (error: any) {
    handleRouteError(error, res, 'Error updating itinerary item');
  }
});

// DELETE /api/trips/:id/itinerary/:itemId
router.delete('/:id/itinerary/:itemId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, itemId } = req.params;

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ error: 'Invalid itinerary item ID format' });
    }

    const item = await ItineraryItem.findById(itemId);
    if (!item || item.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    const title = item.title;
    await ItineraryItem.findByIdAndDelete(itemId);

    await logActivity(tripId, req.user!.userId, 'ITINERARY_DELETED', `deleted itinerary item "${title}"`);
    emitToTrip(tripId, 'itinerary.deleted', { itemId });

    res.json({ message: 'Itinerary item deleted successfully' });
  } catch (error: any) {
    handleRouteError(error, res, 'Error deleting itinerary item');
  }
});

export default router;
