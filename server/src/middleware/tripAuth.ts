import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { TripMember } from '../models';

export interface TripAuthRequest extends AuthRequest {
  tripMember?: {
    role: 'ADMIN' | 'MEMBER';
  };
}

export const requireTripMembership = async (req: TripAuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  const tripId = req.params.tripId || req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!tripId) {
    return res.status(400).json({ error: 'Trip ID parameter missing' });
  }

  try {
    const member = await TripMember.findOne({ tripId, userId });
    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this trip' });
    }

    req.tripMember = { role: member.role };
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error checking trip membership' });
  }
};

export const requireTripAdmin = async (req: TripAuthRequest, res: Response, next: NextFunction) => {
  if (req.tripMember?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
  next();
};
