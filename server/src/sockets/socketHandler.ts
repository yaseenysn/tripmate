import { Server as SocketIOServer, Socket } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export const initSocket = (io: SocketIOServer) => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('join_trip', (tripId: string) => {
      socket.join(`trip_${tripId}`);
      console.log(`[Socket.IO] Socket ${socket.id} joined trip room trip_${tripId}`);
    });

    socket.on('leave_trip', (tripId: string) => {
      socket.leave(`trip_${tripId}`);
      console.log(`[Socket.IO] Socket ${socket.id} left trip room trip_${tripId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

export const emitToTrip = (tripId: string, event: string, payload: any) => {
  if (ioInstance) {
    ioInstance.to(`trip_${tripId}`).emit(event, payload);
  }
};

export const emitToUser = (userId: string, event: string, payload: any) => {
  if (ioInstance) {
    ioInstance.to(`user_${userId}`).emit(event, payload);
  }
};
