import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { logger } from './utils/logger';

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database', '✅ Connected successfully');
  } catch (error) {
    logger.error('Database', '❌ Connection failed', { error });
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info('Server', `🚀 Running on http://localhost:${env.PORT}/api`, {
      env: env.NODE_ENV,
      port: env.PORT,
    });
  });

  const shutdown = async () => {
    logger.warn('Server', '🛑 Shutting down gracefully...');
    server.close();
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
