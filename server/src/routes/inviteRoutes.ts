import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { Trip, TripInvite, TripMember, User } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireTripMembership, requireTripAdmin, TripAuthRequest } from '../middleware/tripAuth';
import { logActivity } from '../services/activityService';
import { createNotification } from '../services/notificationService';
import { sendInviteEmail } from '../services/emailService';
import { emitToTrip } from '../sockets/socketHandler';

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

// Helper to obtain the clean Frontend Base URL (Vercel domain)
export const getFrontendBaseUrl = (req?: Request): string => {
  const rawEnv = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : '';
  console.log(`[Invite Debug] Raw process.env.FRONTEND_URL: "${rawEnv}"`);

  if (rawEnv && rawEnv !== '*') {
    const firstUrl = rawEnv.split(',')[0].trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
    if (firstUrl && !firstUrl.includes('onrender.com') && !firstUrl.includes(':5000')) {
      console.log(`[Invite Debug] Using FRONTEND_URL env var: "${firstUrl}"`);
      return firstUrl;
    }
  }

  if (req) {
    const originHeader = req.get('origin') || req.get('referer');
    if (originHeader) {
      try {
        const u = new URL(originHeader);
        const cleanOrigin = u.origin.replace(/\/$/, '');
        if (!cleanOrigin.includes('onrender.com') && !cleanOrigin.includes(':5000')) {
          console.log(`[Invite Debug] Using Request Origin/Referer header: "${cleanOrigin}"`);
          return cleanOrigin;
        }
      } catch (e) {}
    }
  }

  console.log(`[Invite Debug] Defaulting to local dev fallback: "http://localhost:3001"`);
  return 'http://localhost:3001';
};

// Send Email Invitation to a user
router.post('/trips/:tripId/invites/email', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { email, message } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid recipient email address' });
    }

    const targetEmail = email.trim().toLowerCase();

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const inviter = await User.findById(req.user!.userId);
    const inviterName = inviter ? inviter.name : 'A TripMate Member';

    // Check if a user with this email is already a member of this trip
    const existingUser = await User.findOne({ email: targetEmail });
    if (existingUser) {
      const isAlreadyMember = await TripMember.findOne({ tripId, userId: existingUser._id });
      if (isAlreadyMember) {
        return res.status(400).json({ error: `User with email ${targetEmail} is already a member of this trip` });
      }
    }

    // Generate unique token and 6-digit code
    const token = crypto.randomBytes(24).toString('hex');
    let code = generate6DigitCode();
    while (await TripInvite.findOne({ code, isActive: true })) {
      code = generate6DigitCode();
    }

    // Expiry: 7 days by default
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await TripInvite.create({
      tripId,
      code,
      token,
      invitedEmail: targetEmail,
      createdBy: req.user!.userId,
      expiresAt,
      usedCount: 0,
      isActive: true
    });

    // Configurable Frontend Join Link
    const frontendBaseUrl = getFrontendBaseUrl(req);
    const inviteUrl = `${frontendBaseUrl}/join/${token}`;
    console.log(`[Invite Debug Email] Generated email inviteUrl: "${inviteUrl}" for ${targetEmail}`);

    // Send formatted Email
    await sendInviteEmail({
      toEmail: targetEmail,
      inviterName,
      tripName: trip.name,
      inviteUrl,
      message
    });

    await logActivity(tripId, req.user!.userId, 'INVITE_SENT', `sent email invitation to ${targetEmail}`);

    res.status(201).json({
      message: `Invitation sent successfully to ${targetEmail}`,
      invite: {
        _id: invite._id,
        token: invite.token,
        code: invite.code,
        invitedEmail: invite.invitedEmail,
        inviteUrl
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error sending email invitation' });
  }
});

// Create general invite link for trip (Admin only)
router.post('/trips/:tripId/invites', authenticateToken, requireTripMembership, requireTripAdmin, async (req: TripAuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { expiresAt, maxUses } = req.body;

    const token = crypto.randomBytes(24).toString('hex');
    let code = generate6DigitCode();

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

    const frontendBaseUrl = getFrontendBaseUrl(req);
    const inviteUrl = `${frontendBaseUrl}/join/${token}`;
    console.log(`[Invite Debug Link] Generated direct inviteUrl: "${inviteUrl}" (Token: ${token})`);

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
router.get('/trips/:tripId/invites', authenticateToken, requireTripMembership, async (req: TripAuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const invites = await TripInvite.find({ tripId, isActive: true }).sort({ createdAt: -1 });

    const frontendBaseUrl = getFrontendBaseUrl(req);

    const enriched = await Promise.all(
      invites.map(async (inv) => {
        const inviteUrl = `${frontendBaseUrl}/join/${inv.token}`;
        console.log(`[Invite Debug List] Enriched invite token ${inv.token} -> inviteUrl: "${inviteUrl}"`);
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

    const trip = await Trip.findById(invite.tripId).populate('createdBy', 'name email avatar');
    if (!trip) {
      return res.status(404).json({ error: 'Associated trip not found' });
    }

    const inviter = await User.findById(invite.createdBy).select('name email avatar');
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
      inviter: {
        name: inviter ? inviter.name : 'A trip member',
        email: inviter ? inviter.email : ''
      },
      invite: {
        code: invite.code,
        token: invite.token,
        invitedEmail: invite.invitedEmail
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching invite preview' });
  }
});

// Join trip via token (Must be authenticated)
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

    // Socket real-time broadcast to trip room
    emitToTrip(trip._id.toString(), 'member.joined', {
      userId,
      tripId: trip._id.toString()
    });

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

    // Socket real-time broadcast
    emitToTrip(trip._id.toString(), 'member.joined', {
      userId,
      tripId: trip._id.toString()
    });

    await logActivity(trip._id.toString(), userId, 'MEMBER_JOINED', `joined the trip using code ${cleanCode}`);
    await createNotification(userId, 'Joined Trip', `You joined "${trip.name}"`, 'TRIP', trip._id.toString());

    res.status(201).json({ message: 'Successfully joined trip', tripId: trip._id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error joining trip with code' });
  }
});

export default router;
