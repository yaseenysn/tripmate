import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { Trip, TripInvite, TripMember } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireTripMembership, requireTripAdmin, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';

const router = Router();

// Generate a random 6-character uppercase alphanumeric code e.g. "LKO8X2"
const generate6DigitCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Create invite for trip (Admin only)
router.post('/trips/:tripId/invites', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { expiresAt, maxUses } = req.body;

    const token = crypto.randomBytes(16).toString('hex');
    let code = generate6DigitCode();

    // Ensure code uniqueness
    while (await TripInvite.findOne({ code, isActive: true })) {
      code = generate6DigitCode();
    }

    const invite = await TripInvite.create({
      tripId,
      code,
      token,
      createdBy: req.user!.userId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
      usedCount: 0,
      isActive: true
    });

    const inviteUrl = `${req.protocol}://${req.get('host')}/join/${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(inviteUrl);

    res.status(201).json({
      invite: {
        ...invite.toObject(),
        inviteUrl,
        qrCodeDataUrl
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error generating trip invite' });
  }
});

// List invites for trip (Admin only)
router.get('/trips/:tripId/invites', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const invites = await TripInvite.find({ tripId, isActive: true }).sort({ createdAt: -1 });

    const enriched = await Promise.all(
      invites.map(async (inv) => {
        const inviteUrl = `${req.protocol}://${req.get('host')}/join/${inv.token}`;
        const qrCodeDataUrl = await QRCode.toDataURL(inviteUrl);
        return {
          ...inv.toObject(),
          inviteUrl,
          qrCodeDataUrl
        };
      })
    );

    res.json({ invites: enriched });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching invites' });
  }
});

// Revoke invite (Admin only)
router.post('/trips/:tripId/invites/:inviteId/revoke', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { inviteId } = req.params;
    const invite = await TripInvite.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    invite.isActive = false;
    await invite.save();

    res.json({ message: 'Invite revoked successfully', invite });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error revoking invite' });
  }
});

// Preview trip by token (Public or authenticated)
router.get('/invites/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const invite = await TripInvite.findOne({ token, isActive: true });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite link' });
    }

    if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ error: 'This invite link has expired' });
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return res.status(400).json({ error: 'This invite link has reached maximum usage limit' });
    }

    const trip = await Trip.findById(invite.tripId).populate('createdBy', 'name avatar');
    if (!trip) {
      return res.status(404).json({ error: 'Associated trip not found' });
    }

    const memberCount = await TripMember.countDocuments({ tripId: trip._id });

    res.json({
      trip: {
        _id: trip._id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        coverImage: trip.coverImage,
        description: trip.description,
        createdBy: trip.createdBy,
        memberCount
      },
      invite: {
        code: invite.code,
        token: invite.token
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching invite preview' });
  }
});

// Join trip via token
router.post('/invites/:token/join', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user!.userId;

    const invite = await TripInvite.findOne({ token, isActive: true });
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite link' });
    }

    if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ error: 'Invite link has expired' });
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return res.status(400).json({ error: 'Invite link has reached max usage limit' });
    }

    const trip = await Trip.findById(invite.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check if user is already a member
    const existingMember = await TripMember.findOne({ tripId: trip._id, userId });
    if (existingMember) {
      return res.json({ message: 'You are already a member of this trip', tripId: trip._id });
    }

    // Create TripMember record
    await TripMember.create({
      tripId: trip._id,
      userId,
      role: 'MEMBER'
    });

    invite.usedCount += 1;
    await invite.save();

    await logActivity(trip._id.toString(), userId, 'MEMBER_JOINED', `joined the trip via invite link`);
    await createNotification(userId, 'Joined Trip', `You joined "${trip.name}"`, 'TRIP', trip._id.toString());

    res.status(201).json({ message: 'Successfully joined trip', tripId: trip._id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error joining trip' });
  }
});

// Join trip via 6-digit code (e.g. "LKO8X2")
router.post('/trips/join-with-code', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    const userId = req.user!.userId;

    if (!code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const invite = await TripInvite.findOne({ code: cleanCode, isActive: true });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid invite code. Please check and try again.' });
    }

    if (invite.expiresAt && new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ error: 'Invite code has expired' });
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return res.status(400).json({ error: 'Invite code usage limit exceeded' });
    }

    const trip = await Trip.findById(invite.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const existingMember = await TripMember.findOne({ tripId: trip._id, userId });
    if (existingMember) {
      return res.json({ message: 'You are already a member of this trip', tripId: trip._id });
    }

    await TripMember.create({
      tripId: trip._id,
      userId,
      role: 'MEMBER'
    });

    invite.usedCount += 1;
    await invite.save();

    await logActivity(trip._id.toString(), userId, 'MEMBER_JOINED', `joined the trip using code ${cleanCode}`);
    await createNotification(userId, 'Joined Trip', `You joined "${trip.name}"`, 'TRIP', trip._id.toString());

    res.status(201).json({ message: 'Successfully joined trip', tripId: trip._id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error joining trip with code' });
  }
});

export default router;
