import { Router, Response } from 'express';
import mongoose from 'mongoose';
import {
  Trip,
  TripMember,
  Expense,
  Budget,
  Settlement,
  Booking,
  DocumentModel,
  Task,
  ItineraryItem,
  Poll,
  PollVote,
  Activity,
  TripInvite,
  Notification,
  UploadedAsset,
  User
} from '../models';
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
import { isSafeString, isValidUrl, isValidNumber, isValidObjectId, handleRouteError } from '../utils/validation';
import { verifyAssetOwnership, handleEntityAssetReplacement } from '../utils/assetSecurity';

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
      Trip.find({ _id: { $in: tripIds } }).populate('createdBy', 'name email avatar').sort({ startDate: 1 }),
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
    handleRouteError(error, res, 'Error fetching user trips');
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

    if (!isSafeString(name, 1, 150)) {
      return res.status(400).json({ error: 'Trip name must be between 1 and 150 characters' });
    }

    if (!isSafeString(destination, 1, 150)) {
      return res.status(400).json({ error: 'Destination must be between 1 and 150 characters' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Start date and end date must be valid dates' });
    }

    if (end < start) {
      return res.status(400).json({ error: 'Trip end date cannot be earlier than start date' });
    }

    if (estimatedBudget !== undefined && !isValidNumber(estimatedBudget, 0)) {
      return res.status(400).json({ error: 'Estimated budget must be a non-negative number' });
    }

    if (coverImage && !isValidUrl(coverImage)) {
      return res.status(400).json({ error: 'Invalid cover image URL protocol. Only HTTP and HTTPS are permitted.' });
    }

    if (currency && !isSafeString(currency, 1, 10)) {
      return res.status(400).json({ error: 'Currency symbol must be between 1 and 10 characters' });
    }

    if (description && !isSafeString(description, 0, 2000)) {
      return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
    }

    if (coverImagePublicId) {
      if (typeof coverImagePublicId !== 'string' || coverImagePublicId.length > 200) {
        return res.status(400).json({ error: 'Invalid coverImagePublicId format' });
      }
      const isOwner = await verifyAssetOwnership(coverImagePublicId, userId!);
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to attach this cover image.' });
      }
    }

    const budgetAmount = Number(estimatedBudget) || 0;
    const initialStatus = 'ACTIVE';

    const trip = await Trip.create({
      name: name.trim(),
      destination: destination.trim(),
      startDate: start,
      endDate: end,
      coverImage:
        coverImage ||
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      coverImagePublicId: coverImagePublicId || undefined,
      currency: currency ? currency.trim() : '₹',
      estimatedBudget: budgetAmount,
      description: description ? description.trim() : '',
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
    handleRouteError(error, res, 'Error creating trip');
  }
});

// GET /api/trips/:id - Get specific trip details & overview data
router.get(
  '/:id',
  authenticateToken,
  requireTripMembership,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const trip = await Trip.findById(req.params.id).populate('createdBy', 'name email avatar');
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
      handleRouteError(error, res, 'Error fetching trip details');
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
      handleRouteError(error, res, 'Error generating finish preview');
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
      handleRouteError(error, res, 'Error finishing trip');
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
      handleRouteError(error, res, 'Error closing trip');
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
      handleRouteError(error, res, 'Error generating trip report');
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

      if (name !== undefined) {
        if (!isSafeString(name, 1, 150)) {
          return res.status(400).json({ error: 'Trip name must be between 1 and 150 characters' });
        }
        trip.name = name.trim();
      }

      if (destination !== undefined) {
        if (!isSafeString(destination, 1, 150)) {
          return res.status(400).json({ error: 'Destination must be between 1 and 150 characters' });
        }
        trip.destination = destination.trim();
      }

      const newStart = startDate ? new Date(startDate) : trip.startDate;
      const newEnd = endDate ? new Date(endDate) : trip.endDate;
      if (startDate && isNaN(new Date(startDate).getTime())) {
        return res.status(400).json({ error: 'Start date must be a valid date' });
      }
      if (endDate && isNaN(new Date(endDate).getTime())) {
        return res.status(400).json({ error: 'End date must be a valid date' });
      }
      if (newEnd < newStart) {
        return res.status(400).json({ error: 'Trip end date cannot be earlier than start date' });
      }
      if (startDate) trip.startDate = newStart;
      if (endDate) trip.endDate = newEnd;

      if (coverImage !== undefined) {
        if (coverImage && !isValidUrl(coverImage)) {
          return res.status(400).json({ error: 'Invalid cover image URL protocol. Only HTTP and HTTPS are permitted.' });
        }
        trip.coverImage = coverImage;
      }
      if (coverImagePublicId !== undefined) {
        if (coverImagePublicId && (typeof coverImagePublicId !== 'string' || coverImagePublicId.length > 200)) {
          return res.status(400).json({ error: 'Invalid coverImagePublicId format' });
        }
        const assetCheck = await handleEntityAssetReplacement(
          oldPublicId,
          coverImagePublicId,
          req.user!.userId,
          'image'
        );
        if (!assetCheck.allowed) {
          return res.status(403).json({ error: assetCheck.error || 'Asset ownership verification failed' });
        }
        trip.coverImagePublicId = coverImagePublicId;
      }
      if (currency !== undefined) {
        if (!isSafeString(currency, 1, 10)) {
          return res.status(400).json({ error: 'Currency symbol must be between 1 and 10 characters' });
        }
        trip.currency = currency.trim();
      }
      if (estimatedBudget !== undefined) {
        if (!isValidNumber(estimatedBudget, 0)) {
          return res.status(400).json({ error: 'Estimated budget must be a non-negative number' });
        }
        trip.estimatedBudget = Number(estimatedBudget);
      }
      if (description !== undefined) {
        if (!isSafeString(description, 0, 2000)) {
          return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
        }
        trip.description = description.trim();
      }
      if (status !== undefined) {
        if (status === 'CLOSED') {
          return res.status(400).json({
            error: 'To close a trip, use the dedicated POST /api/trips/:id/close endpoint to ensure financial settlement reconciliation.'
          });
        }
        if (!['UPCOMING', 'ACTIVE', 'COMPLETED'].includes(status)) {
          return res.status(400).json({ error: 'Status must be one of UPCOMING, ACTIVE, or COMPLETED' });
        }
        trip.status = status;
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
      const populatedTrip = await Trip.findById(trip._id).populate('createdBy', 'name email avatar');
      emitToTrip(trip._id.toString(), 'trip.updated', populatedTrip || trip);

      res.json({ trip: populatedTrip || trip });
    } catch (error: any) {
      handleRouteError(error, res, 'Error updating trip');
    }
  }
);

// POST /api/trips/:id/leave - Leave a trip/group
router.post(
  '/:id/leave',
  authenticateToken,
  requireTripMembership,
  requireNotClosedTrip,
  async (req: TripAuthRequest, res: Response) => {
    try {
      const tripId = req.params.id;
      const userId = req.user!.userId;

      const trip = await Trip.findById(tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      const memberDoc = await TripMember.findOne({ tripId, userId }).populate('userId', 'name email');
      if (!memberDoc) {
        return res.status(404).json({ error: 'You are not a member of this trip' });
      }

      const memberName = (memberDoc.userId as any)?.name || 'Member';
      const totalMembers = await TripMember.countDocuments({ tripId });
      const targetUserIdStr = userId.toString();

      // 1. Ownership check: If member is the trip creator/owner and other members exist, require transferring ownership first
      const ownerId = (trip.createdBy?._id || trip.createdBy).toString();
      const isOwner = ownerId === targetUserIdStr;
      if (isOwner && totalMembers > 1) {
        return res.status(400).json({
          error: 'You are the group owner. You must transfer group ownership to another member before leaving the group.'
        });
      }

      // 2. Sole Admin check: If member is the sole admin and other members exist, require promoting another admin
      if (memberDoc.role === 'ADMIN' && totalMembers > 1) {
        const adminCount = await TripMember.countDocuments({ tripId, role: 'ADMIN' });
        if (adminCount <= 1) {
          return res.status(400).json({
            error: 'You are the sole administrator of this group. Please promote another member to admin before leaving.'
          });
        }
      }

      // 3. Strict Financial Safety: Verify member has zero net balance
      const calculation = await calculateTripBalancesAndSettlements(tripId);
      const targetBalance = calculation.memberBalances.find((m) => m.userId === targetUserIdStr);

      if (targetBalance && Math.abs(targetBalance.netBalance) > 0.01) {
        const isOwed = targetBalance.netBalance > 0;
        return res.status(400).json({
          error: `Cannot leave the group because you have an unsettled balance of ₹${Math.abs(targetBalance.netBalance).toFixed(2)} (${isOwed ? 'to receive' : 'to pay'}). All balances must be settled before leaving.`
        });
      }

      // Remove the member
      await TripMember.deleteOne({ _id: memberDoc._id });

      // If no members are left, clean up the trip (preserving financial records)
      if (totalMembers <= 1) {
        await Trip.findByIdAndDelete(tripId);
        await Booking.deleteMany({ tripId });
        await DocumentModel.deleteMany({ tripId });
        await Task.deleteMany({ tripId });
        await ItineraryItem.deleteMany({ tripId });
        await Poll.deleteMany({ tripId });
        await PollVote.deleteMany({ tripId });
        await Activity.deleteMany({ tripId });
        await TripInvite.deleteMany({ tripId });
        await Notification.deleteMany({ $or: [{ tripId }, { link: tripId.toString() }] });

        emitToTrip(tripId, 'trip.deleted', { tripId });
        return res.json({ message: 'You have left the group. As the sole member, the group has been deleted.', groupDeleted: true });
      }

      // Log activity and emit socket events
      await logActivity(
        tripId,
        userId,
        'MEMBER_LEFT',
        `${memberName} left the group`
      );

      emitToTrip(tripId, 'member.left', {
        tripId,
        userId,
        memberId: memberDoc._id
      });
      emitToTrip(tripId, 'member.removed', {
        memberId: memberDoc._id
      });

      res.json({ message: 'You have successfully left the group' });
    } catch (error: any) {
      handleRouteError(error, res, 'Error leaving group');
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

      // Verify asset ownership before deleting Cloudinary cover image
      if (trip && trip.coverImagePublicId) {
        const ownsOld = await verifyAssetOwnership(trip.coverImagePublicId, req.user!.userId);
        if (ownsOld) {
          await deleteFromCloudinary(trip.coverImagePublicId, 'image');
          await UploadedAsset.deleteOne({ publicId: trip.coverImagePublicId });
        }
      }

      // Cascade cleanup across non-financial collections (preserving financial records for accounting integrity)
      await Trip.findByIdAndDelete(tripId);
      await TripMember.deleteMany({ tripId });
      await Booking.deleteMany({ tripId });
      await DocumentModel.deleteMany({ tripId });
      await Task.deleteMany({ tripId });
      await ItineraryItem.deleteMany({ tripId });
      await Poll.deleteMany({ tripId });
      await PollVote.deleteMany({ tripId });
      await Activity.deleteMany({ tripId });
      await TripInvite.deleteMany({ tripId });
      await Notification.deleteMany({ $or: [{ tripId }, { link: tripId.toString() }] });

      emitToTrip(tripId, 'trip.deleted', { tripId });

      res.json({ message: 'Trip deleted successfully' });
    } catch (error: any) {
      handleRouteError(error, res, 'Error deleting trip');
    }
  }
);

export default router;
