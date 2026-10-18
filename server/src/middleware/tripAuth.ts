import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { TripMember } from '../models';
import { isValidObjectId } from '../utils/validation';

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

  if (!isValidObjectId(tripId)) {
    return res.status(400).json({ error: 'Invalid trip ID format. Expected a 24-character hexadecimal ObjectId.' });
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

export const requireNotClosedTrip = async (req: TripAuthRequest, res: Response, next: NextFunction) => {
  const tripId = req.params.tripId || req.params.id;
  if (!tripId) return next();
  if (!isValidObjectId(tripId)) {
    return res.status(400).json({ error: 'Invalid trip ID format. Expected a 24-character hexadecimal ObjectId.' });
  }

  try {
    const { Trip } = await import('../models');
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status === 'CLOSED') {
      return res.status(403).json({
        error: 'This trip is CLOSED and read-only. Modifications to closed trips are not permitted.'
      });
    }
    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Error checking trip state' });
  }
};

