'use strict';

require('dotenv').config();

const http = require('http');
const { createApp }      = require('./app');
const { connectMongoDB } = require('./config/database');
const { connectRedis, getRedisClient } = require('./config/redis');
const { buildLimiters }  = require('./config/rateLimiter');
const { initWebSocket }  = require('./websocket/socket');
const logger = require('./common/logger');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // 1. Connect to databases
  await connectMongoDB();
  const redisClient = await connectRedis();

  // 2. Build Redis-backed rate limiters (shared across nodes in production)
  const limiters = buildLimiters(redisClient);

  // 3. Create Express app with limiters injected
  const app    = createApp(limiters);
  const server = http.createServer(app);

  // 4. Attach WebSocket server
  initWebSocket(server);

  // 5. Start listening
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`🌍 ENV : ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 API : http://localhost:${PORT}/api/v1`);
    logger.info(`❤️  Health: http://localhost:${PORT}/health`);
  });

  // 6. Graceful shutdown
  const shutdown = async (sig) => {
    logger.info(`${sig} received – shutting down…`);
    server.close(async () => {
      try {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        await getRedisClient().quit();
        logger.info('All connections closed. Goodbye!');
      } catch (e) { logger.error(e); }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (r) => logger.error('Unhandled rejection:', r));
  process.on('uncaughtException',  (e) => { logger.error('Uncaught exception:', e); process.exit(1); });

  return server;
}

bootstrap().catch((err) => { console.error('Bootstrap failed:', err); process.exit(1); });
