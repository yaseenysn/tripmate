import { Router, Response } from 'express';
import { Booking } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';

const router = Router();

// GET /api/trips/:id/bookings
router.get('/:id/bookings', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const bookings = await Booking.find({ tripId }).populate('createdBy', 'name avatar').sort({ date: 1 });
    res.json({ bookings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching bookings' });
  }
});

// POST /api/trips/:id/bookings
router.post('/:id/bookings', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { type, provider, bookingReference, date, time, location, cost, notes, attachmentUrl, attachmentPublicId } = req.body;

    if (!type || !provider || !date) {
      return res.status(400).json({ error: 'Type, provider, and date are required' });
    }

    const booking = await Booking.create({
      tripId,
      type,
      provider,
      bookingReference: bookingReference || '',
      date: new Date(date),
      time: time || '',
      location: location || '',
      cost: Number(cost) || 0,
      notes: notes || '',
      attachmentUrl: attachmentUrl || '',
      attachmentPublicId: attachmentPublicId || undefined,
      createdBy: userId
    });

    const populated = await Booking.findById(booking._id).populate('createdBy', 'name avatar');

    await logActivity(tripId, userId, 'BOOKING_ADDED', `added ${type} booking with ${provider}`);
    emitToTrip(tripId, 'booking.created', populated);

    res.status(201).json({ booking: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating booking' });
  }
});

// PATCH /api/trips/:id/bookings/:bookingId
router.patch('/:id/bookings/:bookingId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, bookingId } = req.params;
    const booking = await Booking.findById(bookingId);

    if (!booking || booking.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const oldPublicId = booking.attachmentPublicId;

    const fields = ['type', 'provider', 'bookingReference', 'date', 'time', 'location', 'cost', 'notes', 'attachmentUrl', 'attachmentPublicId'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        (booking as any)[field] = field === 'date' ? new Date(req.body[field]) : req.body[field];
      }
    });

    if (oldPublicId && req.body.attachmentPublicId && oldPublicId !== req.body.attachmentPublicId) {
      await deleteFromCloudinary(oldPublicId, 'raw');
      await deleteFromCloudinary(oldPublicId, 'image');
    }

    await booking.save();
    const populated = await Booking.findById(booking._id).populate('createdBy', 'name avatar');

    await logActivity(tripId, req.user!.userId, 'BOOKING_UPDATED', `updated ${booking.type} booking (${booking.provider})`);
    emitToTrip(tripId, 'booking.updated', populated);

    res.json({ booking: populated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating booking' });
  }
});

// DELETE /api/trips/:id/bookings/:bookingId
router.delete('/:id/bookings/:bookingId', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, bookingId } = req.params;
    const booking = await Booking.findById(bookingId);

    if (!booking || booking.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.attachmentPublicId) {
      await deleteFromCloudinary(booking.attachmentPublicId, 'raw');
      await deleteFromCloudinary(booking.attachmentPublicId, 'image');
    }

    const provider = booking.provider;
    await Booking.findByIdAndDelete(bookingId);

    await logActivity(tripId, req.user!.userId, 'BOOKING_DELETED', `deleted booking for ${provider}`);
    emitToTrip(tripId, 'booking.deleted', { bookingId });

    res.json({ message: 'Booking deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting booking' });
  }
});

export default router;
