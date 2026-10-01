import { Activity } from '../models';
import { emitToTrip } from '../sockets/socketHandler';

export const logActivity = async (
  tripId: string,
  userId: string,
  type: string,
  description: string,
  metadata?: Record<string, any>
) => {
  try {
    const activity = await Activity.create({
      tripId,
      userId,
      type,
      description,
      metadata
    });

    const populated = await Activity.findById(activity._id).populate('userId', 'name avatar');

    emitToTrip(tripId, 'activity.created', populated);
    return populated;
  } catch (error) {
    console.error('[ActivityService] Error creating activity:', error);
  }
};
