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
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
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

    socket.on('connect_error', (err) => {
      console.error(`[Socket.IO Client] Connect error:`, err.message);
    });
  }
  return socket;
};

export const joinTripRoom = (tripId: string) => {
  if (!tripId) return;
  const cleanTripId = String(tripId).trim();

  if (currentJoinedRoom && currentJoinedRoom !== cleanTripId) {
    leaveTripRoom(currentJoinedRoom);
  }

  currentJoinedRoom = cleanTripId;
  const s = getSocket();

  if (s.connected) {
    s.emit('join_trip', cleanTripId);
    console.log(`[Socket.IO Client] Emitted join_trip for room: trip_${cleanTripId}`);
  } else {
    console.log(`[Socket.IO Client] Socket connecting... Queued join_trip for room: trip_${cleanTripId}`);
  }
};

export const leaveTripRoom = (tripId: string) => {
  if (!tripId) return;
  const cleanTripId = String(tripId).trim();
  if (currentJoinedRoom === cleanTripId) {
    currentJoinedRoom = null;
  }
  const s = getSocket();
  if (s.connected) {
    s.emit('leave_trip', cleanTripId);
    console.log(`[Socket.IO Client] Emitted leave_trip for room: trip_${cleanTripId}`);
  }
};
