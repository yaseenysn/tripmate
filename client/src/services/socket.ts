import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentJoinedRoom: string | null = null;

const resolveSocketUrl = (): string => {
  const envSocket = import.meta.env.VITE_SOCKET_URL;
  if (envSocket && typeof envSocket === 'string' && envSocket.trim()) {
    return envSocket.trim().replace(/\/$/, '').replace(/\/api$/, '');
  }
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi && typeof envApi === 'string' && envApi.trim()) {
    return envApi.trim().replace(/\/$/, '').replace(/\/api$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    // Local area network IP (e.g. mobile testing on 192.168.x.x)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
  }
  return 'http://localhost:5000';
};

export const getSocket = (): Socket => {
  if (!socket) {
    const rawUrl = resolveSocketUrl();

    console.log(`[Socket.IO Client] Initializing connection to: ${rawUrl}`);

    socket = io(rawUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    // Register ONE global 'connect' handler on socket creation for connect & reconnect
    socket.on('connect', () => {
      console.log(`[RTCHAT] SOCKET_CONNECTED socketId=${socket?.id}`);
      if (currentJoinedRoom) {
        console.log(`[RTCHAT] trip_room_join_requested room=trip_${currentJoinedRoom} (reconnect)`);
        socket?.emit('join_trip', currentJoinedRoom, (ack: any) => {
          console.log(`[RTCHAT] JOIN_ACK_RECEIVED room=${ack?.room} count=${ack?.roomSocketCount}`);
        });
      }
    });

    socket.on('trip_room_joined', (ack: any) => {
      console.log(`[RTCHAT] JOIN_ACK_RECEIVED room=${ack?.room} count=${ack?.roomSocketCount}`);
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[RTCHAT] DISCONNECTED reason=${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket.IO Client] Connect error to ${rawUrl}:`, err.message);
    });
  }
  return socket;
};

export const joinTripRoom = (tripId: string) => {
  if (!tripId) return;
  const cleanTripId = String(tripId).trim();

  // If changing trips, leave previous room
  if (currentJoinedRoom && currentJoinedRoom !== cleanTripId) {
    leaveTripRoom(currentJoinedRoom);
  }

  currentJoinedRoom = cleanTripId;
  const s = getSocket();

  console.log(`[RTCHAT] trip_room_join_requested room=trip_${cleanTripId}`);

  if (s.connected) {
    s.emit('join_trip', cleanTripId, (ack: any) => {
      console.log(`[RTCHAT] trip_room_join_confirmed room=trip_${ack?.tripId} count=${ack?.roomSocketCount}`);
    });
  } else {
    console.log(`[Socket.IO Client] Queued room join for connect event: trip_${cleanTripId}`);
  }
};

export const leaveTripRoom = (tripId: string) => {
  if (!tripId) return;
  const cleanTripId = String(tripId).trim();
  if (currentJoinedRoom === cleanTripId) {
    currentJoinedRoom = null;
  }
  if (socket && socket.connected) {
    socket.emit('leave_trip', cleanTripId);
    console.log(`[Socket.IO Client] Emitted leave_trip for room: trip_${cleanTripId}`);
  }
};
