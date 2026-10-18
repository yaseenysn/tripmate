import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { isValidEmail, isValidUrl, isSafeString, handleRouteError } from '../utils/validation';
import { handleEntityAssetReplacement } from '../utils/assetSecurity';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';

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
    const user = await User.findById(req.user?.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error: any) {
    handleRouteError(error, res, 'Server error');
  }
});

// Update Profile
router.patch('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, avatarPublicId } = req.body;
    const user = await User.findById(req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldPublicId = user.avatarPublicId;

    if (name !== undefined) {
      if (!isSafeString(name, 1, 100)) {
        return res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
      }
      user.name = name.trim();
    }
    if (avatar !== undefined) {
      if (avatar && !isValidUrl(avatar)) {
        return res.status(400).json({ error: 'Invalid avatar URL protocol. Only HTTP and HTTPS are permitted.' });
      }
      user.avatar = avatar;
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

    await user.save();

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        avatarPublicId: user.avatarPublicId,
      }
    });
  } catch (error: any) {
    handleRouteError(error, res, 'Error updating profile');
  }
});

export default router;
