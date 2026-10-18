import { Router, Response } from 'express';
import { Booking, UploadedAsset } from '../models';
import { authenticateToken } from '../middleware/auth';
import { requireTripMembership, requireNotClosedTrip, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';
import { isValidObjectId, isValidUrl, isSafeString, isValidNumber, handleRouteError } from '../utils/validation';
import { verifyAssetOwnership, handleEntityAssetReplacement } from '../utils/assetSecurity';

const ALLOWED_BOOKING_TYPES = ['FLIGHT', 'TRAIN', 'BUS', 'HOTEL', 'CAB', 'ACTIVITY', 'OTHER'];

const router = Router();

// GET /api/trips/:id/bookings
router.get('/:id/bookings', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const bookings = await Booking.find({ tripId }).populate('createdBy', 'name avatar').sort({ date: 1 });
    res.json({ bookings });
  } catch (error: any) {
    handleRouteError(error, res, 'Error fetching bookings');
  }
});

// POST /api/trips/:id/bookings
router.post('/:id/bookings', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const userId = req.user!.userId;
    const { type, provider, bookingReference, date, time, location, cost, notes, attachmentUrl, attachmentPublicId } = req.body;

    if (!type || !provider || !date) {
      return res.status(400).json({ error: 'Type, provider, and date are required' });
    }

    if (!ALLOWED_BOOKING_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid booking type. Must be one of: ${ALLOWED_BOOKING_TYPES.join(', ')}` });
    }

    if (!isSafeString(provider, 1, 150)) {
      return res.status(400).json({ error: 'Provider must be between 1 and 150 characters' });
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: 'Date must be a valid date' });
    }

    if (cost !== undefined && !isValidNumber(cost, 0)) {
      return res.status(400).json({ error: 'Booking cost must be a non-negative number' });
    }

    if (attachmentUrl && !isValidUrl(attachmentUrl)) {
      return res.status(400).json({ error: 'Invalid attachment URL protocol. Only HTTP and HTTPS are permitted.' });
    }

    if (bookingReference && !isSafeString(bookingReference, 0, 100)) {
      return res.status(400).json({ error: 'Booking reference must not exceed 100 characters' });
    }

    if (notes && !isSafeString(notes, 0, 2000)) {
      return res.status(400).json({ error: 'Notes must not exceed 2000 characters' });
    }

    if (time && !isSafeString(time, 0, 50)) {
      return res.status(400).json({ error: 'Time must not exceed 50 characters' });
    }

    if (location && !isSafeString(location, 0, 200)) {
      return res.status(400).json({ error: 'Location must not exceed 200 characters' });
    }

    if (attachmentPublicId) {
      if (typeof attachmentPublicId !== 'string' || attachmentPublicId.length > 200) {
        return res.status(400).json({ error: 'Invalid attachmentPublicId format' });
      }
      const isOwner = await verifyAssetOwnership(attachmentPublicId, userId);
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to attach this asset.' });
      }
    }

    const booking = await Booking.create({
      tripId,
      type,
      provider,
      bookingReference: bookingReference || '',
      date: new Date(date),
      time: time ? time.trim() : '',
      location: location ? location.trim() : '',
      cost: Number(cost) || 0,
      notes: notes || '',
      attachmentUrl: attachmentUrl || '',
      attachmentPublicId: attachmentPublicId || undefined,
      createdBy: userId
    });

    const populated = await Booking.findById(booking._id).populate('createdBy', 'name avatar');

    await logActivity(
      tripId,
      userId,
      'BOOKING_ADDED',
      `added ${type} booking with ${provider}`,
      { bookingId: booking._id, booking: populated }
    );
    emitToTrip(tripId, 'booking.created', populated);

    res.status(201).json({ booking: populated });
  } catch (error: any) {
    handleRouteError(error, res, 'Error creating booking');
  }
});

// PATCH /api/trips/:id/bookings/:bookingId
router.patch('/:id/bookings/:bookingId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, bookingId } = req.params;

    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const isCreator = booking.createdBy.toString() === req.user!.userId;
    const isAdmin = req.tripMember?.role === 'ADMIN';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to edit this booking' });
    }

    const { type, provider, bookingReference, date, time, location, cost, notes, attachmentUrl, attachmentPublicId } = req.body;

    if (type !== undefined) {
      if (!ALLOWED_BOOKING_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid booking type. Must be one of: ${ALLOWED_BOOKING_TYPES.join(', ')}` });
      }
      booking.type = type;
    }
    if (provider !== undefined) {
      if (!isSafeString(provider, 1, 150)) {
        return res.status(400).json({ error: 'Provider must be between 1 and 150 characters' });
      }
      booking.provider = provider.trim();
    }
    if (date !== undefined) {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Date must be a valid date' });
      }
      booking.date = d;
    }
    if (cost !== undefined) {
      if (!isValidNumber(cost, 0)) {
        return res.status(400).json({ error: 'Booking cost must be a non-negative number' });
      }
      booking.cost = Number(cost);
    }
    if (attachmentUrl !== undefined) {
      if (attachmentUrl && !isValidUrl(attachmentUrl)) {
        return res.status(400).json({ error: 'Invalid attachment URL protocol. Only HTTP and HTTPS are permitted.' });
      }
      booking.attachmentUrl = attachmentUrl;
    }
    if (bookingReference !== undefined) {
      if (bookingReference && !isSafeString(bookingReference, 0, 100)) {
        return res.status(400).json({ error: 'Booking reference must not exceed 100 characters' });
      }
      booking.bookingReference = bookingReference.trim();
    }
    if (time !== undefined) {
      if (time && !isSafeString(time, 0, 50)) {
        return res.status(400).json({ error: 'Time must not exceed 50 characters' });
      }
      booking.time = time ? time.trim() : '';
    }
    if (location !== undefined) {
      if (location && !isSafeString(location, 0, 200)) {
        return res.status(400).json({ error: 'Location must not exceed 200 characters' });
      }
      booking.location = location ? location.trim() : '';
    }
    if (notes !== undefined) {
      if (notes && !isSafeString(notes, 0, 2000)) {
        return res.status(400).json({ error: 'Notes must not exceed 2000 characters' });
      }
      booking.notes = notes.trim();
    }

    const oldPublicId = booking.attachmentPublicId;
    if (attachmentPublicId !== undefined) {
      if (attachmentPublicId && (typeof attachmentPublicId !== 'string' || attachmentPublicId.length > 200)) {
        return res.status(400).json({ error: 'Invalid attachmentPublicId format' });
      }
      const assetCheck = await handleEntityAssetReplacement(
        oldPublicId,
        attachmentPublicId,
        req.user!.userId,
        'image'
      );
      if (!assetCheck.allowed) {
        return res.status(403).json({ error: assetCheck.error || 'Asset ownership verification failed' });
      }
      booking.attachmentPublicId = attachmentPublicId;
    }

    await booking.save();
    const populated = await Booking.findById(booking._id).populate('createdBy', 'name avatar');

    await logActivity(tripId, req.user!.userId, 'BOOKING_UPDATED', `updated ${booking.type} booking (${booking.provider})`);
    emitToTrip(tripId, 'booking.updated', populated);

    res.json({ booking: populated });
  } catch (error: any) {
    handleRouteError(error, res, 'Error updating booking');
  }
});

// DELETE /api/trips/:id/bookings/:bookingId
router.delete('/:id/bookings/:bookingId', authenticateToken, requireTripMembership, requireNotClosedTrip, async (req: TripAuthRequest, res: Response) => {
  try {
    const { id: tripId, bookingId } = req.params;

    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.tripId.toString() !== tripId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const isCreator = booking.createdBy.toString() === req.user!.userId;
    const isAdmin = req.tripMember?.role === 'ADMIN';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this booking' });
    }

    if (booking.attachmentPublicId) {
      const ownsOld = await verifyAssetOwnership(booking.attachmentPublicId, req.user!.userId);
      if (ownsOld) {
        await deleteFromCloudinary(booking.attachmentPublicId, 'image');
        await UploadedAsset.deleteOne({ publicId: booking.attachmentPublicId });
      }
    }

    const provider = booking.provider;
    await Booking.findByIdAndDelete(bookingId);

    await logActivity(tripId, req.user!.userId, 'BOOKING_DELETED', `deleted booking for ${provider}`);
    emitToTrip(tripId, 'booking.deleted', { bookingId });

    res.json({ message: 'Booking deleted successfully' });
  } catch (error: any) {
    handleRouteError(error, res, 'Error deleting booking');
  }
});

export default router;
