import { Server as SocketIOServer, Socket } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export const initSocket = (io: SocketIOServer) => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`[RTCHAT] socket_connected socketId=${socket.id}`);

    socket.on('join_trip', (tripId: string, ackCallback?: (res: any) => void) => {
      const cleanTripId = String(tripId).trim();
      const room = `trip_${cleanTripId}`;
      socket.join(room);
      const roomSocketCount = ioInstance?.sockets.adapter.rooms.get(room)?.size || 0;
      console.log(`[RTCHAT] socket_joined_room socketId=${socket.id} room=${room} count=${roomSocketCount}`);
      
      const payload = { tripId: cleanTripId, room, socketId: socket.id, roomSocketCount };
      socket.emit('trip_room_joined', payload);
      if (typeof ackCallback === 'function') {
        ackCallback(payload);
      }
    });

    socket.on('leave_trip', (tripId: string) => {
      const cleanTripId = String(tripId).trim();
      const room = `trip_${cleanTripId}`;
      socket.leave(room);
      console.log(`[Socket.IO] Socket ${socket.id} left trip room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

export const emitToTrip = (tripId: string, event: string, payload: any) => {
  if (ioInstance) {
    const cleanTripId = String(tripId).trim();
    const targetRoom = `trip_${cleanTripId}`;
    const roomSocketCount = ioInstance.sockets.adapter.rooms.get(targetRoom)?.size || 0;
    
    console.log(`[RTCHAT] emitting_activity_created event=${event}`);
    console.log(`[RTCHAT] trip_id=${cleanTripId}`);
    console.log(`[RTCHAT] target_room=${targetRoom}`);
    console.log(`[RTCHAT] room_socket_count=${roomSocketCount}`);

    ioInstance.to(targetRoom).emit(event, payload);
  }
};

export const emitToUser = (userId: string, event: string, payload: any) => {
  if (ioInstance) {
    ioInstance.to(`user_${String(userId).trim()}`).emit(event, payload);
  }
};

