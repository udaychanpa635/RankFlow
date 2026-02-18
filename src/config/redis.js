'use strict';

const Redis = require('ioredis');
const logger = require('../common/logger');

let redisClient = null;

const KEYS = {
  globalLeaderboard:  ()       => 'leaderboard:global',
  gameLeaderboard:    (gameId) => `leaderboard:game:${gameId}`,
  dailyLeaderboard:   (date)   => `leaderboard:daily:${date}`,
  weeklyLeaderboard:  (week)   => `leaderboard:weekly:${week}`,
};

async function connectRedis() {
  redisClient = new Redis({
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  redisClient.on('ready',        () => logger.info('✅ Redis connected'));
  redisClient.on('error',   (e) => logger.error('Redis error:', e.message));
  redisClient.on('reconnecting', () => logger.info('🔄 Redis reconnecting…'));

  await redisClient.connect();
  await redisClient.ping();
  return redisClient;
}

function getRedisClient() {
  if (!redisClient) throw new Error('Redis not initialised. Call connectRedis() first.');
  return redisClient;
}

module.exports = { connectRedis, getRedisClient, KEYS };
