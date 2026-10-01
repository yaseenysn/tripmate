import { Router, Response } from 'express';
import { ItineraryItem } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';

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
    res.status(500).json({ error: error.message || 'Error fetching itinerary' });
  }
});

// POST /api/trips/:id/itinerary
router.post('/:id/itinerary', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { dayNumber, date, startTime, endTime, title, location, description, estimatedCost, assignedMembers, notes } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required for itinerary item' });
    }

    const item = await ItineraryItem.create({
      tripId,
      dayNumber: Number(dayNumber) || 1,
      date: new Date(date),
      startTime: startTime || '10:00',
      endTime: endTime || '',
      title,
      location: location || '',
      description: description || '',
      estimatedCost: Number(estimatedCost) || 0,
      assignedMembers: assignedMembers || [],
      notes: notes || ''
    });

    const populated = await ItineraryItem.findById(item._id).populate('assignedMembers', 'name avatar email');

    await logActivity(tripId, userId, 'ITINERARY_ADDED', `added Day ${item.dayNumber} itinerary item "${title}"`);
    emitToTrip(tripId, 'itinerary.created', populated);

    res.status(201).json({ item: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating itinerary item' });
  }
});

// PATCH /api/trips/:id/itinerary/:itemId
router.patch('/:id/itinerary/:itemId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, itemId } = req.params;

    const item = await ItineraryItem.findById(itemId);
    if (!item || item.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Itinerary item not found' });
    }

    const fields = ['dayNumber', 'date', 'startTime', 'endTime', 'title', 'location', 'description', 'estimatedCost', 'assignedMembers', 'notes', 'order'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        (item as any)[field] = field === 'date' ? new Date(req.body[field]) : req.body[field];
      }
    });

    await item.save();
    const populated = await ItineraryItem.findById(item._id).populate('assignedMembers', 'name avatar email');

    await logActivity(tripId, req.user!.userId, 'ITINERARY_UPDATED', `updated itinerary item "${item.title}"`);
    emitToTrip(tripId, 'itinerary.updated', populated);

    res.json({ item: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating itinerary item' });
  }
});

// DELETE /api/trips/:id/itinerary/:itemId
router.delete('/:id/itinerary/:itemId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, itemId } = req.params;

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
    res.status(500).json({ error: error.message || 'Error deleting itinerary item' });
  }
});

export default router;
