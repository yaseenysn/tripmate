import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const rawUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000')
      .trim()
      .replace(/\/$/, '')
      .replace(/\/api$/, '');

    socket = io(rawUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};

export const joinTripRoom = (tripId: string) => {
  const s = getSocket();
  s.emit('join_trip', tripId);
};

export const leaveTripRoom = (tripId: string) => {
  const s = getSocket();
  s.emit('leave_trip', tripId);
};
