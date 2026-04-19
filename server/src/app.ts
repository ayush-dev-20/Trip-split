import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, generalLimiter } from './middleware';
import { logger } from './utils/logger';

// Route imports
import authRoutes from './routes/authRoutes';
import groupRoutes from './routes/groupRoutes';
import tripRoutes from './routes/tripRoutes';
import expenseRoutes from './routes/expenseRoutes';
import settlementRoutes from './routes/settlementRoutes';
import socialRoutes from './routes/socialRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import aiRoutes from './routes/aiRoutes';
import billingRoutes from './routes/billingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import checkpointRoutes from './routes/checkpointRoutes';

const app = express();

// ──────────────────────────────────
// Global Middleware
// ──────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());

// ── Structured request / response logger ──
app.use((req, res, next) => {
  const start = Date.now();
  const skip = ['/api/health'];
  if (!skip.includes(req.path)) {
    logger.request(req.method, req.path, req.body);
  }
  res.on('finish', () => {
    if (!skip.includes(req.path)) {
      logger.response(req.method, req.path, res.statusCode, Date.now() - start);
    }
  });
  next();
});

// JSON parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', generalLimiter);

// ──────────────────────────────────
// Health Check
// ──────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Expense Tracker API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────
// API Routes
// ──────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/trips', checkpointRoutes);

// ──────────────────────────────────
// 404 Handler
// ──────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Route not found', code: 'NOT_FOUND' },
  });
});

// ──────────────────────────────────
// Global Error Handler
// ──────────────────────────────────

app.use(errorHandler);

export default app;
