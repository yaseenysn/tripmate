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
import uploadRoutes from './routes/uploadRoutes';

import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

if (process.env.USE_MEMORY_DB === 'true') {
  delete process.env.MONGODB_URI;
  console.log('[Server Isolation] USE_MEMORY_DB active: MONGODB_URI deleted from process environment.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS configuration supporting FRONTEND_URL env var and local development
const getCorsOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  const origins = frontendUrl ? frontendUrl.split(',').map(url => url.trim().replace(/\/$/, '')) : [];
  return Array.from(new Set([
    ...origins,
    'https://tripmate-ten-mu.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000'
  ]));
};

const allowedOrigins = getCorsOrigins();

const corsOriginHandler = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (like mobile apps, curl, Postman)
  if (!origin) return callback(null, true);
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'https://tripmate-ten-mu.vercel.app' ||
    origin.endsWith('.vercel.app') ||
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes('*')
  ) {
    return callback(null, true);
  }
  callback(null, false);
};

app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Initialize Socket.IO
initSocket(io);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
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

// JSON 404 Handler for all /api routes - Never return HTML!
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global JSON Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express API Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
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
