import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentJoinedRoom: string | null = null;

const resolveSocketUrl = (): string => {
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const isLocalDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

  // 1. Use a valid, non-empty VITE_SOCKET_URL (normalized without trailing slashes or /api)
  // Use localhost ONLY when frontend is actually running on localhost or 127.0.0.1 in development
  const envSocket = import.meta.env.VITE_SOCKET_URL;
  if (envSocket && typeof envSocket === 'string' && envSocket.trim()) {
    const cleanSocket = envSocket.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
    const isSocketLocal = cleanSocket.includes('localhost') || cleanSocket.includes('127.0.0.1');
    if (cleanSocket && (!isSocketLocal || isLocalDev)) {
      return cleanSocket;
    }
  }

  // 2. Otherwise, derive the Socket.IO base URL from VITE_API_URL by removing a trailing /api
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi && typeof envApi === 'string' && envApi.trim()) {
    const cleanApi = envApi.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
    const isApiLocal = cleanApi.includes('localhost') || cleanApi.includes('127.0.0.1');
    if (cleanApi && (!isApiLocal || isLocalDev)) {
      return cleanApi;
    }
  }

  // 3. Use localhost:5000 ONLY when the frontend is actually running on localhost or 127.0.0.1 in development
  if (isLocalDev) {
    const protocol = isBrowser ? window.location.protocol : 'http:';
    return `${protocol}//${hostname}:5000`;
  }

  // 4. NEVER fall back to localhost:5000 on a deployed Vercel hostname
  if (isBrowser && window.location.hostname.includes('vercel.app')) {
    return 'https://tripmate-glxh.onrender.com';
  }

  // 5. If production configuration is missing, fail clearly with a useful diagnostic error
  const errorMsg =
    '[Socket.IO] Missing VITE_SOCKET_URL and VITE_API_URL in production environment. Realtime chat cannot initialize without backend URL.';
  console.error(errorMsg);
  throw new Error(errorMsg);
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
