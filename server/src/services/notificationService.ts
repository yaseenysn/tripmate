import { Notification } from '../models';
import { emitToTrip } from '../sockets/socketHandler';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string = 'INFO',
  tripId?: string,
  link?: string
) => {
  try {
    const notif = await Notification.create({
      userId,
      tripId,
      title,
      message,
      type,
      link,
      isRead: false
    });

    if (tripId) {
      emitToTrip(tripId, 'notification.created', notif);
    }
    return notif;
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error);
  }
};
