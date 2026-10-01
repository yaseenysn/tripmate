import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const backendUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:5000';
    socket = io(backendUrl, {
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
