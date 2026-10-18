import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { TripMember } from '../models';

const JWT_SECRET = process.env.JWT_SECRET || 'tripmate_super_secret_jwt_key_2026';

let ioInstance: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    email: string;
  };
}

export const initSocket = (io: SocketIOServer) => {
  ioInstance = io;

  // Socket.IO Handshake Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const rawToken =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader) ||
        socket.handshake.query?.token;

      if (!rawToken || typeof rawToken !== 'string') {
        return next(new Error('Authentication error: Access token required'));
      }

      const token = rawToken.startsWith('Bearer ') ? rawToken.split(' ')[1] : rawToken;
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.user?.userId;
    console.log(`[RTCHAT] CLIENT_CONNECTED socketId=${socket.id} userId=${userId}`);

    // Join personal user room for private notifications
    if (userId) {
      socket.join(`user_${userId}`);
    }

    socket.on('join_trip', async (tripId: string, ackCallback?: (res: any) => void) => {
      const currentUserId = socket.user?.userId;
      if (!currentUserId) {
        const errPayload = { error: 'Authentication required' };
        socket.emit('error', errPayload);
        if (typeof ackCallback === 'function') ackCallback(errPayload);
        return;
      }

      const cleanTripId = String(tripId || '').trim();
      if (!cleanTripId || !mongoose.Types.ObjectId.isValid(cleanTripId)) {
        const errPayload = { error: 'Invalid trip ID parameter' };
        socket.emit('error', errPayload);
        if (typeof ackCallback === 'function') ackCallback(errPayload);
        return;
      }

      try {
        // Enforce trip membership check before granting room access
        const member = await TripMember.findOne({
          tripId: new mongoose.Types.ObjectId(cleanTripId),
          userId: new mongoose.Types.ObjectId(currentUserId)
        });

        if (!member) {
          const errPayload = { error: 'Access denied: You are not a member of this trip' };
          socket.emit('error', errPayload);
          if (typeof ackCallback === 'function') ackCallback(errPayload);
          return;
        }

        const room = `trip_${cleanTripId}`;
        console.log(`[RTCHAT] JOIN_REQUEST socketId=${socket.id} userId=${currentUserId} tripId=${cleanTripId} room=${room}`);

        await socket.join(room);
        const roomSocketCount = ioInstance?.sockets.adapter.rooms.get(room)?.size || 0;
        console.log(`[RTCHAT] JOIN_CONFIRMED socketId=${socket.id} room=${room} count=${roomSocketCount}`);

        const payload = { success: true, tripId: cleanTripId, room, socketId: socket.id, roomSocketCount };
        socket.emit('trip_room_joined', payload);
        if (typeof ackCallback === 'function') {
          ackCallback(payload);
        }
      } catch (err: any) {
        console.error(`[RTCHAT] Error verifying trip membership for socket ${socket.id}:`, err);
        const errPayload = { error: 'Server error checking trip membership' };
        socket.emit('error', errPayload);
        if (typeof ackCallback === 'function') ackCallback(errPayload);
      }
    });

    socket.on('leave_trip', async (tripId: string) => {
      const cleanTripId = String(tripId).trim();
      const room = `trip_${cleanTripId}`;
      await socket.leave(room);
      console.log(`[RTCHAT] LEAVE_CONFIRMED socketId=${socket.id} room=${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[RTCHAT] DISCONNECTED socketId=${socket.id}`);
    });
  });
};

export const emitToTrip = (tripId: string, event: string, payload: any) => {
  if (ioInstance) {
    const cleanTripId = String(tripId).trim();
    const targetRoom = `trip_${cleanTripId}`;
    const roomSocketCount = ioInstance.sockets.adapter.rooms.get(targetRoom)?.size || 0;

    console.log(`[RTCHAT] SOCKET_EMIT event=${event}`);
    console.log(`[RTCHAT] TRIP_ID ${cleanTripId}`);
    console.log(`[RTCHAT] ROOM_NAME ${targetRoom}`);
    console.log(`[RTCHAT] ROOM_SOCKET_COUNT ${roomSocketCount}`);

    ioInstance.to(targetRoom).emit(event, payload);
  }
};

export const emitToUser = (userId: string, event: string, payload: any) => {
  if (ioInstance) {
    ioInstance.to(`user_${String(userId).trim()}`).emit(event, payload);
  }
};

