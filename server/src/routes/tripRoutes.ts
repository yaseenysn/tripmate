import { Router, Response } from 'express';
import { Trip, TripMember, Expense, Budget } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireTripMembership, requireTripAdmin, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';

const router = Router();

// Helper to determine status from dates
const computeTripStatus = (startDate: Date, endDate: Date): 'UPCOMING' | 'ACTIVE' | 'COMPLETED' => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (now < start) return 'UPCOMING';
  if (now > end) return 'COMPLETED';
  return 'ACTIVE';
};

// GET /api/trips - Get all trips for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const memberships = await TripMember.find({ userId });
    const tripIds = memberships.map(m => m.tripId);

    const trips = await Trip.find({ _id: { $in: tripIds } }).sort({ startDate: 1 });

    // Enrich trips with counts and spending
    const enrichedTrips = await Promise.all(
      trips.map(async (trip) => {
        const memberCount = await TripMember.countDocuments({ tripId: trip._id });
        const expenses = await Expense.find({ tripId: trip._id });
        const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

        const currentStatus = computeTripStatus(trip.startDate, trip.endDate);

        return {
          ...trip.toObject(),
          memberCount,
          totalSpent,
          status: currentStatus
        };
      })
    );

    res.json({ trips: enrichedTrips });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching user trips' });
  }
});

// POST /api/trips - Create new trip
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, destination, startDate, endDate, coverImage, coverImagePublicId, currency, estimatedBudget, description } = req.body;

    if (!name || !destination || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, destination, start date, and end date are required' });
    }

    const budgetAmount = Number(estimatedBudget) || 0;
    const status = computeTripStatus(new Date(startDate), new Date(endDate));

    const trip = await Trip.create({
      name,
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      coverImage: coverImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      coverImagePublicId: coverImagePublicId || undefined,
      currency: currency || '₹',
      estimatedBudget: budgetAmount,
      description: description || '',
      createdBy: userId,
      status
    });

    // Automatically make creator an ADMIN member
    await TripMember.create({
      tripId: trip._id,
      userId,
      role: 'ADMIN'
    });

    // Create default budget record
    await Budget.create({
      tripId: trip._id,
      totalBudget: budgetAmount,
      categoryBudgets: [
        { category: 'Transportation', plannedAmount: Math.round(budgetAmount * 0.25) },
        { category: 'Accommodation', plannedAmount: Math.round(budgetAmount * 0.35) },
        { category: 'Food', plannedAmount: Math.round(budgetAmount * 0.20) },
        { category: 'Activities', plannedAmount: Math.round(budgetAmount * 0.10) },
        { category: 'Miscellaneous', plannedAmount: Math.round(budgetAmount * 0.10) }
      ]
    });

    await logActivity(trip._id.toString(), userId!, 'TRIP_CREATED', `created trip "${trip.name}"`);

    res.status(201).json({ trip });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating trip' });
  }
});

// GET /api/trips/:id - Get specific trip details & overview data
router.get('/:id', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const members = await TripMember.find({ tripId: trip._id }).populate('userId', 'name email avatar');
    const expenses = await Expense.find({ tripId: trip._id });
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const budgetDoc = await Budget.findOne({ tripId: trip._id });

    const status = computeTripStatus(trip.startDate, trip.endDate);

    res.json({
      trip: {
        ...trip.toObject(),
        status,
        memberCount: members.length,
        totalSpent,
        userRole: req.tripMember?.role
      },
      members: members.map(m => ({
        _id: m._id,
        user: m.userId,
        role: m.role,
        joinedAt: m.joinedAt
      })),
      budget: budgetDoc
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching trip details' });
  }
});

// PATCH /api/trips/:id - Update trip (Admin only)
router.patch('/:id', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { name, destination, startDate, endDate, coverImage, coverImagePublicId, currency, estimatedBudget, description, status } = req.body;

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const oldPublicId = trip.coverImagePublicId;

    if (name) trip.name = name;
    if (destination) trip.destination = destination;
    if (startDate) trip.startDate = new Date(startDate);
    if (endDate) trip.endDate = new Date(endDate);
    if (coverImage !== undefined) trip.coverImage = coverImage;
    if (coverImagePublicId !== undefined) trip.coverImagePublicId = coverImagePublicId;
    if (currency) trip.currency = currency;
    if (estimatedBudget !== undefined) trip.estimatedBudget = Number(estimatedBudget);
    if (description !== undefined) trip.description = description;
    if (status) trip.status = status;

    if (oldPublicId && coverImagePublicId && oldPublicId !== coverImagePublicId) {
      await deleteFromCloudinary(oldPublicId, 'image');
    }

    await trip.save();

    // Update total budget if requested
    if (estimatedBudget !== undefined) {
      await Budget.findOneAndUpdate(
        { tripId: trip._id },
        { totalBudget: Number(estimatedBudget) },
        { upsert: true }
      );
    }

    await logActivity(trip._id.toString(), req.user!.userId, 'TRIP_UPDATED', `updated trip settings`);
    emitToTrip(trip._id.toString(), 'trip.updated', trip);

    res.json({ trip });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating trip' });
  }
});

// DELETE /api/trips/:id - Delete trip (Admin only)
router.delete('/:id', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const tripId = req.params.id;
    const trip = await Trip.findById(tripId);
    if (trip && trip.coverImagePublicId) {
      await deleteFromCloudinary(trip.coverImagePublicId, 'image');
    }

    await Trip.findByIdAndDelete(tripId);
    await TripMember.deleteMany({ tripId });
    await Expense.deleteMany({ tripId });
    await Budget.deleteMany({ tripId });

    res.json({ message: 'Trip deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting trip' });
  }
});

export default router;
