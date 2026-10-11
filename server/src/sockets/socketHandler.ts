import { Server as SocketIOServer, Socket } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export const initSocket = (io: SocketIOServer) => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`[RTCHAT] CLIENT_CONNECTED socketId=${socket.id}`);

    socket.on('join_trip', async (tripId: string, ackCallback?: (res: any) => void) => {
      const cleanTripId = String(tripId).trim();
      const room = `trip_${cleanTripId}`;
      console.log(`[RTCHAT] JOIN_REQUEST socketId=${socket.id} tripId=${cleanTripId} room=${room}`);
      
      await socket.join(room);
      const roomSocketCount = ioInstance?.sockets.adapter.rooms.get(room)?.size || 0;
      console.log(`[RTCHAT] JOIN_CONFIRMED socketId=${socket.id} room=${room} count=${roomSocketCount}`);
      
      const payload = { tripId: cleanTripId, room, socketId: socket.id, roomSocketCount };
      socket.emit('trip_room_joined', payload);
      if (typeof ackCallback === 'function') {
        ackCallback(payload);
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

