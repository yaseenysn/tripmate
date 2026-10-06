import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentJoinedRoom: string | null = null;

export const getSocket = () => {
  if (!socket) {
    const rawUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000')
      .trim()
      .replace(/\/$/, '')
      .replace(/\/api$/, '');

    console.log(`[Socket.IO Client] Initializing connection to: ${rawUrl}`);

    socket = io(rawUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log(`[Socket.IO Client] Connected with ID: ${socket?.id}`);
      if (currentJoinedRoom) {
        socket?.emit('join_trip', currentJoinedRoom);
        console.log(`[Socket.IO Client] Re-joined room trip_${currentJoinedRoom} on connect`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[Socket.IO Client] Disconnected: ${reason}`);
    });
  }
  return socket;
};

export const joinTripRoom = (tripId: string) => {
  currentJoinedRoom = tripId;
  const s = getSocket();
  if (s.connected) {
    s.emit('join_trip', tripId);
    console.log(`[Socket.IO Client] Emitted join_trip for: ${tripId}`);
  }
};

export const leaveTripRoom = (tripId: string) => {
  if (currentJoinedRoom === tripId) {
    currentJoinedRoom = null;
  }
  const s = getSocket();
  if (s.connected) {
    s.emit('leave_trip', tripId);
    console.log(`[Socket.IO Client] Emitted leave_trip for: ${tripId}`);
  }
};
