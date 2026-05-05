import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { logger } from './utils/logger';

// Create HTTP server so socket.io can share the same port
const httpServer = createServer(app);

// ──────────────────────────────────
// Socket.io Setup
// ──────────────────────────────────

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  logger.debug('Socket', `Client connected: ${socket.id}`);

  // Join a trip room to receive real-time trip events
  socket.on('join:trip', (tripId: string) => {
    socket.join(`trip:${tripId}`);
    logger.debug('Socket', `Socket ${socket.id} joined trip:${tripId}`);
  });

  // Leave a trip room
  socket.on('leave:trip', (tripId: string) => {
    socket.leave(`trip:${tripId}`);
    logger.debug('Socket', `Socket ${socket.id} left trip:${tripId}`);
  });

  // Join personal notification room
  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
    logger.debug('Socket', `Socket ${socket.id} joined user:${userId}`);
  });

  socket.on('disconnect', () => {
    logger.debug('Socket', `Client disconnected: ${socket.id}`);
  });
});

// ──────────────────────────────────
// Server Bootstrap
// ──────────────────────────────────

async function main() {
  // ── Debug: show which Clerk keys are loaded ─────────────────────────────────
  const pk = env.CLERK_PUBLISHABLE_KEY;
  const sk = env.CLERK_SECRET_KEY;
  logger.info('Clerk', `Publishable key: ${pk ? pk.slice(0, 20) + '…' : '❌ MISSING'}`);
  logger.info('Clerk', `Secret key:      ${sk ? sk.slice(0, 14) + '…' : '❌ MISSING'}`);
  // ────────────────────────────────────────────────────────────────────────────

  try {
    await prisma.$connect();
    logger.info('Database', '✅ Connected successfully');
  } catch (error) {
    logger.error('Database', '❌ Connection failed', { error });
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    logger.info('Server', `🚀 Running on http://localhost:${env.PORT}/api`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
    logger.info('Socket', '🔌 Socket.io ready');
  });

  const shutdown = async () => {
    logger.warn('Server', '🛑 Shutting down gracefully...');
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
