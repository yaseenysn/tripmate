import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  User,
  Trip,
  TripMember,
  Booking,
  DocumentModel,
  Task,
  Poll,
  PollVote,
  Activity,
  UploadedAsset,
} from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { isValidEmail, isValidUrl, isSafeString, handleRouteError } from '../utils/validation';
import { handleEntityAssetReplacement } from '../utils/assetSecurity';
import { emitToTrip } from '../sockets/socketHandler';
import { sendEmailVerificationCode } from '../services/emailService';
import { calculateTripBalancesAndSettlements } from '../services/settlementService';
import { deleteFromCloudinary } from '../config/cloudinary';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';

const isValidPhoneNumber = (phone: string): boolean => {
  if (!phone || !phone.trim()) return true;
  return /^\+?[0-9\s\-().]{7,25}$/.test(phone.trim());
};

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, avatar } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (!isSafeString(name, 1, 100)) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }

    if (avatar && !isValidUrl(avatar)) {
      return res.status(400).json({ error: 'Invalid avatar URL protocol. Only HTTP and HTTPS are permitted.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`
    });

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Error registering user');
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Error logging in');
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// Me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select('-passwordHash -emailVerificationCode');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const groupCount = await TripMember.countDocuments({ userId });

    res.json({
      user: {
        ...user.toObject(),
        groupCount,
      },
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Server error');
  }
});

// Update Profile
router.patch('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, avatarPublicId, bio, phone } = req.body;
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldPublicId = user.avatarPublicId;
    let hasNameOrAvatarChanged = false;

    if (name !== undefined) {
      if (!isSafeString(name, 1, 100)) {
        return res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
      }
      if (user.name !== name.trim()) {
        user.name = name.trim();
        hasNameOrAvatarChanged = true;
      }
    }

    if (avatar !== undefined) {
      if (avatar && !isValidUrl(avatar)) {
        return res.status(400).json({ error: 'Invalid avatar URL protocol. Only HTTP and HTTPS are permitted.' });
      }
      if (user.avatar !== avatar) {
        user.avatar = avatar;
        hasNameOrAvatarChanged = true;
      }
    }

    if (avatarPublicId !== undefined) {
      if (avatarPublicId && (typeof avatarPublicId !== 'string' || avatarPublicId.length > 200)) {
        return res.status(400).json({ error: 'Invalid avatarPublicId format' });
      }
      const assetCheck = await handleEntityAssetReplacement(
        oldPublicId,
        avatarPublicId,
        user._id.toString(),
        'image'
      );
      if (!assetCheck.allowed) {
        return res.status(403).json({ error: assetCheck.error || 'Asset ownership verification failed' });
      }
      user.avatarPublicId = avatarPublicId;
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string') {
        return res.status(400).json({ error: 'Bio must be a string' });
      }
      if (!isSafeString(bio, 0, 500)) {
        return res.status(400).json({ error: 'Bio must not exceed 500 characters' });
      }
      user.bio = bio.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return res.status(400).json({ error: 'Phone must be a string' });
      }
      if (phone.trim() && !isValidPhoneNumber(phone)) {
        return res.status(400).json({ error: 'Please enter a valid phone number (e.g. +1234567890)' });
      }
      user.phone = phone.trim();
    }

    await user.save();

    // Global Profile Synchronization: Broadcast updated profile to all active trips the user belongs to
    const memberships = await TripMember.find({ userId: user._id });
    for (const m of memberships) {
      emitToTrip(m.tripId.toString(), 'user.profile_updated', {
        userId: user._id.toString(),
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        phone: user.phone,
      });
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        avatarPublicId: user.avatarPublicId,
        bio: user.bio,
        phone: user.phone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Error updating profile');
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 6 and 128 characters' });
    }

    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password cannot be identical to current password' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    handleRouteError(error, res, 'Error changing password');
  }
});

// POST /api/auth/request-email-change
router.post('/request-email-change', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'New email and current password are required' });
    }

    if (!isValidEmail(newEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (cleanNewEmail === user.email.toLowerCase()) {
      return res.status(400).json({ error: 'New email is identical to your current email' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password verification' });
    }

    const existingUser = await User.findOne({ email: cleanNewEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists' });
    }

    // Generate secure 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.pendingEmail = cleanNewEmail;
    user.emailVerificationCode = code;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    await sendEmailVerificationCode({
      toEmail: cleanNewEmail,
      userName: user.name,
      code,
    });

    res.json({
      message: `A 6-digit verification code has been sent to ${cleanNewEmail}.`,
      pendingEmail: cleanNewEmail,
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Error requesting email change');
  }
});

// POST /api/auth/verify-email-change
router.post('/verify-email-change', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.pendingEmail || !user.emailVerificationCode || !user.emailVerificationExpires) {
      return res.status(400).json({ error: 'No pending email change request found' });
    }

    if (new Date() > user.emailVerificationExpires) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (code.trim() !== user.emailVerificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Re-verify email is still not taken
    const conflictingUser = await User.findOne({ email: user.pendingEmail });
    if (conflictingUser && conflictingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ error: 'Email address has already been claimed by another account' });
    }

    const updatedEmail = user.pendingEmail;
    user.email = updatedEmail;
    user.pendingEmail = undefined;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Issue refreshed JWT token with updated email
    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Broadcast update to user's trips
    const memberships = await TripMember.find({ userId: user._id });
    for (const m of memberships) {
      emitToTrip(m.tripId.toString(), 'user.profile_updated', {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        phone: user.phone,
      });
    }

    res.json({
      message: 'Email address updated successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        phone: user.phone,
      },
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Error verifying email change');
  }
});

// POST /api/auth/delete-account
router.post('/delete-account', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { password, confirmationText } = req.body;
    const userId = req.user?.userId;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete your account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const expectedConfirm = user.email.toLowerCase();
    if (
      !confirmationText ||
      (confirmationText.trim().toLowerCase() !== 'delete' &&
        confirmationText.trim().toLowerCase() !== expectedConfirm)
    ) {
      return res.status(400).json({
        error: `Please confirm account deletion by entering "DELETE" or your email address (${user.email}).`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password verification' });
    }

    // 1. Group Ownership Check: User cannot delete account if they are the sole owner of a trip with other members
    const ownedTrips = await Trip.find({ createdBy: user._id });
    for (const trip of ownedTrips) {
      if (trip.status !== 'CLOSED') {
        const memberCount = await TripMember.countDocuments({ tripId: trip._id });
        if (memberCount > 1) {
          return res.status(400).json({
            error: `Cannot delete account: You are the group owner of "${trip.name}". You must transfer group ownership to another member before deleting your account.`,
          });
        }
      }
    }

    // 2. Strict Financial Safety: User cannot delete account if they have an unsettled net balance in any active trip
    const memberships = await TripMember.find({ userId: user._id });
    for (const m of memberships) {
      const trip = await Trip.findById(m.tripId);
      if (trip && trip.status !== 'CLOSED') {
        const calculation = await calculateTripBalancesAndSettlements(trip._id.toString());
        const userBal = calculation.memberBalances.find((b) => b.userId === user._id.toString());
        if (userBal && Math.abs(userBal.netBalance) > 0.01) {
          const isOwed = userBal.netBalance > 0;
          return res.status(400).json({
            error: `Cannot delete account: You have an unsettled balance of ₹${Math.abs(userBal.netBalance).toFixed(
              2
            )} (${isOwed ? 'to receive' : 'to pay'}) in group "${trip.name}". All balances must be settled before deleting your account.`,
          });
        }
      }
    }

    // 3. Clean up memberships and single-user workspaces safely
    for (const m of memberships) {
      const tripId = m.tripId;
      const totalMembers = await TripMember.countDocuments({ tripId });

      if (totalMembers <= 1) {
        // Cascade delete single-member workspace non-financial records
        await Promise.all([
          Trip.deleteOne({ _id: tripId }),
          TripMember.deleteMany({ tripId }),
          Booking.deleteMany({ tripId }),
          DocumentModel.deleteMany({ tripId }),
          Task.deleteMany({ tripId }),
          Poll.deleteMany({ tripId }),
          PollVote.deleteMany({ tripId }),
          Activity.deleteMany({ tripId }),
        ]);
        // Historical Expense and Settlement records are intentionally preserved!
      } else {
        await TripMember.deleteOne({ _id: m._id });
        emitToTrip(tripId.toString(), 'member.left', {
          tripId: tripId.toString(),
          userId: user._id.toString(),
        });
      }
    }

    // 4. Delete avatar asset if tracked in Cloudinary
    if (user.avatarPublicId) {
      try {
        await deleteFromCloudinary(user.avatarPublicId, 'image');
        await UploadedAsset.deleteOne({ publicId: user.avatarPublicId });
      } catch {
        // Safe to continue
      }
    }

    // 5. Delete User record
    await User.deleteOne({ _id: user._id });

    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    handleRouteError(error, res, 'Error deleting account');
  }
});

export default router;
