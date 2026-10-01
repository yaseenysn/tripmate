import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { initSocket } from './sockets/socketHandler';
import { runSeed } from './seed';
import { User } from './models';

// Import Routes
import authRoutes from './routes/authRoutes';
import tripRoutes from './routes/tripRoutes';
import inviteRoutes from './routes/inviteRoutes';
import memberRoutes from './routes/memberRoutes';
import expenseRoutes from './routes/expenseRoutes';
import budgetRoutes from './routes/budgetRoutes';
import settlementRoutes from './routes/settlementRoutes';
import itineraryRoutes from './routes/itineraryRoutes';
import bookingRoutes from './routes/bookingRoutes';
import documentRoutes from './routes/documentRoutes';
import taskRoutes from './routes/taskRoutes';
import pollRoutes from './routes/pollRoutes';
import activityRoutes from './routes/activityRoutes';
import notificationRoutes from './routes/notificationRoutes';

import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS configuration supporting FRONTEND_URL env var
const getCorsOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl || frontendUrl.trim() === '*' || frontendUrl.trim() === '') {
    return '*';
  }
  const origins = frontendUrl.split(',').map(url => url.trim().replace(/\/$/, ''));
  // Always include local dev origins alongside production FRONTEND_URL if not wildcard
  return Array.from(new Set([...origins, 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000']));
};

const allowedOrigins = getCorsOrigins();

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Initialize Socket.IO
initSocket(io);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api', inviteRoutes);
app.use('/api/trips', memberRoutes);
app.use('/api/trips', expenseRoutes);
app.use('/api/trips', budgetRoutes);
app.use('/api/trips', settlementRoutes);
app.use('/api/trips', itineraryRoutes);
app.use('/api/trips', bookingRoutes);
app.use('/api/trips', documentRoutes);
app.use('/api/trips', taskRoutes);
app.use('/api/trips', pollRoutes);
app.use('/api/trips', activityRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Server & Connect Database
const startServer = async () => {
  try {
    await connectDB();

    // Check if database is empty; if so, run seed automatically!
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[Server] Database is empty. Running initial demo seed...');
        await runSeed();
      }
    } catch (seedErr: any) {
      console.warn('[Server] Initial seed check warning:', seedErr.message || seedErr);
    }

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`Server running on port ${PORT}`);
      console.log(`🚀 TripMate Backend active on http://localhost:${PORT}`);
      console.log(`⚡ Socket.IO real-time engine active`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
