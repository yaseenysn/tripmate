import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Trip, TripMember, Expense, Budget, Settlement } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  requireTripMembership,
  requireTripAdmin,
  requireNotClosedTrip,
  TripAuthRequest
} from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { emitToTrip } from '../sockets/socketHandler';
import { deleteFromCloudinary } from '../config/cloudinary';
import {
  calculateTripBalancesAndSettlements,
  generateAuthoritativeTripReport
} from '../services/settlementService';

const router = Router();

// Helper to determine status from stored value and dates
export const resolveTripStatus = (trip: any): 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'SETTLED' | 'CLOSED' => {
  // If explicitly closed, settled, or completed in DB, preserve that authoritative state
  if (trip.status === 'CLOSED' || trip.status === 'SETTLED' || trip.status === 'COMPLETED') {
    return trip.status;
  }

  const now = new Date();
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  end.setHours(23, 59, 59, 999);

  if (trip.status === 'ACTIVE') return 'ACTIVE';
  if (now < start) return 'UPCOMING';
  if (now > end) return 'COMPLETED';
  return 'ACTIVE';
};

// GET /api/trips - Get all trips for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const memberships = await TripMember.find({ userId }).select('tripId').lean();
    if (!memberships || memberships.length === 0) {
      return res.json({ trips: [] });
    }
    const tripIds = memberships.map((m) => m.tripId);
    const tripObjectIds = tripIds.map((id: any) => new mongoose.Types.ObjectId(id));

    // Parallel fetch: trips list + grouped member counts + grouped expense totals
    const [trips, memberCountAgg, expenseTotalAgg] = await Promise.all([
      Trip.find({ _id: { $in: tripIds } }).sort({ startDate: 1 }),
      TripMember.aggregate([
        { $match: { tripId: { $in: tripObjectIds } } },
        { $group: { _id: '$tripId', count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { tripId: { $in: tripObjectIds } } },
        { $group: { _id: '$tripId', totalSpent: { $sum: '$amount' } } }
      ])
    ]);

    const memberCountMap = new Map<string, number>(
      memberCountAgg.map((m: any) => [m._id.toString(), Number(m.count) || 0])
    );
    const expenseTotalMap = new Map<string, number>(
      expenseTotalAgg.map((e: any) => [e._id.toString(), Number(e.totalSpent) || 0])
    );

    // Enrich trips with pre-aggregated counts, spending, and authoritative status
    const enrichedTrips = trips.map((trip) => {
      const tIdStr = trip._id.toString();
      const memberCount = memberCountMap.get(tIdStr) || 0;
      const totalSpent = expenseTotalMap.get(tIdStr) || 0;
      const currentStatus = resolveTripStatus(trip);

      return {
        ...trip.toObject(),
        memberCount,
        totalSpent,
        status: currentStatus
      };
    });

    res.json({ trips: enrichedTrips });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching user trips' });
  }
});

// POST /api/trips - Create new trip
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      name,
      destination,
      startDate,
      endDate,
      coverImage,
      coverImagePublicId,
      currency,
      estimatedBudget,
      description
    } = req.body;

    if (!name || !destination || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Name, destination, start date, and end date are required'
      });
    }

    const budgetAmount = Number(estimatedBudget) || 0;
    const initialStatus = 'ACTIVE';

    const trip = await Trip.create({
      name,
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      coverImage:
        coverImage ||
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      coverImagePublicId: coverImagePublicId || undefined,
      currency: currency || '₹',
      estimatedBudget: budgetAmount,
      description: description || '',
      createdBy: userId,
      status: initialStatus,
      settlementStatus: 'PENDING'
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
        { category: 'Food', plannedAmount: Math.round(budgetAmount * 0.2) },
        { category: 'Activities', plannedAmount: Math.round(budgetAmount * 0.1) },
        { category: 'Miscellaneous', plannedAmount: Math.round(budgetAmount * 0.1) }
      ]
    });

    await logActivity(
      trip._id.toString(),
      userId!,
      'TRIP_CREATED',
      `created trip "${trip.name}"`
    );

    res.status(201).json({ trip });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating trip' });
  }
});

// GET /api/trips/:id - Get specific trip details & overview data
router.get(
  '/:id',
  authenticateToken,
  requireTripMembership,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const tripObjectId = new mongoose.Types.ObjectId(trip._id);
      const [members, expenseSumAgg, budgetDoc] = await Promise.all([
        TripMember.find({ tripId: trip._id }).populate(
          'userId',
          'name email avatar'
        ),
        Expense.aggregate([
          { $match: { tripId: tripObjectId } },
          { $group: { _id: null, totalSpent: { $sum: '$amount' } } }
        ]),
        Budget.findOne({ tripId: trip._id })
      ]);
      const totalSpent = expenseSumAgg[0]?.totalSpent || 0;

      const status = resolveTripStatus(trip);

      res.json({
        trip: {
          ...trip.toObject(),
          status,
          settlementStatus: trip.settlementStatus || 'PENDING',
          memberCount: members.length,
          totalSpent,
          userRole: req.tripMember?.role
        },
        members: members.map((m) => ({
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
  }
);

// GET /api/trips/:id/finish-preview - Confirmation Screen metrics before finishing trip
router.get(
  '/:id/finish-preview',
  authenticateToken,
  requireTripMembership,
  requireTripAdmin,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const tripId = req.params.id;
      const trip = await Trip.findById(tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const calculation = await calculateTripBalancesAndSettlements(tripId);
      const memberCount = await TripMember.countDocuments({ tripId });

      res.json({
        tripId: trip._id,
        tripName: trip.name,
        currentStatus: resolveTripStatus(trip),
        totalExpenses: calculation.totalExpenses,
        memberCount,
        pendingSettlementsCount: calculation.suggestedSettlements.length,
        outstandingAmount: calculation.outstandingAmount,
        settlementStatus: calculation.settlementStatus,
        memberBalances: calculation.memberBalances,
        suggestedSettlements: calculation.suggestedSettlements
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error generating finish preview' });
    }
  }
);

// POST /api/trips/:id/finish - Transition trip from ACTIVE to COMPLETED (Admin only)
router.post(
  '/:id/finish',
  authenticateToken,
  requireTripMembership,
  requireTripAdmin,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const tripId = req.params.id;
      const trip = await Trip.findById(tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      if (trip.status === 'CLOSED') {
        return res.status(400).json({ error: 'Cannot finish a trip that is already CLOSED' });
      }

      // Check current calculation to establish settlementStatus
      const calculation = await calculateTripBalancesAndSettlements(tripId);

      trip.status = 'COMPLETED';
      trip.settlementStatus = calculation.settlementStatus;
      trip.completedAt = new Date();
      trip.completedBy = req.user!.userId as any;
      await trip.save();

      await logActivity(
        tripId,
        req.user!.userId,
        'TRIP_FINISHED',
        `marked trip "${trip.name}" as COMPLETED. Balances & settlements remain accessible.`
      );

      emitToTrip(tripId, 'trip.updated', trip);
      emitToTrip(tripId, 'trip.lifecycle', {
        tripId,
        status: 'COMPLETED',
        settlementStatus: trip.settlementStatus,
        trip
      });

      res.json({
        message: 'Trip successfully marked as COMPLETED',
        trip,
        calculation
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error finishing trip' });
    }
  }
);

// POST /api/trips/:id/close - Explicitly CLOSE and archive trip (Admin only, requires all settled)
router.post(
  '/:id/close',
  authenticateToken,
  requireTripMembership,
  requireTripAdmin,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const tripId = req.params.id;
      const trip = await Trip.findById(tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      if (trip.status === 'CLOSED') {
        return res.json({ message: 'Trip is already closed', trip });
      }

      // Check authoritative settlements: all balances must reconcile to zero & no outstanding debts
      const calculation = await calculateTripBalancesAndSettlements(tripId);
      if (calculation.settlementStatus !== 'SETTLED' || calculation.outstandingAmount > 0.01) {
        return res.status(400).json({
          error:
            'Cannot close trip while required settlements remain outstanding. All balances must be reconciled and paid before closure.',
          outstandingAmount: calculation.outstandingAmount,
          suggestedSettlements: calculation.suggestedSettlements
        });
      }

      trip.status = 'CLOSED';
      trip.settlementStatus = 'SETTLED';
      trip.closedAt = new Date();
      trip.closedBy = req.user!.userId as any;
      await trip.save();

      await logActivity(
        tripId,
        req.user!.userId,
        'TRIP_CLOSED',
        `officially closed and archived trip "${trip.name}". Records are now preserved and read-only.`
      );

      emitToTrip(tripId, 'trip.updated', trip);
      emitToTrip(tripId, 'trip.lifecycle', {
        tripId,
        status: 'CLOSED',
        settlementStatus: 'SETTLED',
        trip
      });

      res.json({
        message: 'Trip closed and archived successfully',
        trip,
        calculation
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error closing trip' });
    }
  }
);

// GET /api/trips/:id/report - Authoritative Trip Summary & Final Report
router.get(
  '/:id/report',
  authenticateToken,
  requireTripMembership,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const report = await generateAuthoritativeTripReport(req.params.id);
      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error generating trip report' });
    }
  }
);

// PATCH /api/trips/:id - Update trip (Admin only, protected against closed trips)
router.patch(
  '/:id',
  authenticateToken,
  requireTripMembership,
  requireTripAdmin,
  requireNotClosedTrip,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const {
        name,
        destination,
        startDate,
        endDate,
        coverImage,
        coverImagePublicId,
        currency,
        estimatedBudget,
        description,
        status
      } = req.body;

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

      await logActivity(
        trip._id.toString(),
        req.user!.userId,
        'TRIP_UPDATED',
        `updated trip settings`
      );
      emitToTrip(trip._id.toString(), 'trip.updated', trip);

      res.json({ trip });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error updating trip' });
    }
  }
);

// DELETE /api/trips/:id - Delete trip (Admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireTripMembership,
  requireTripAdmin,
  requireNotClosedTrip,
  async (req: TripAuthRequest, res: Response) => {
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
      await Settlement.deleteMany({ tripId });

      res.json({ message: 'Trip deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error deleting trip' });
    }
  }
);

export default router;
