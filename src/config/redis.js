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
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL not found in environment variables");
  }

  redisClient = new Redis(redisUrl, {
    tls: {},                     // ⭐ required for Railway Redis
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redisClient.on('connect', () => logger.info('✅ Redis connected'));
  redisClient.on('error', (e) => logger.error('Redis error:', e.message));
  redisClient.on('reconnecting', () => logger.info('🔄 Redis reconnecting…'));

  await redisClient.ping();
  return redisClient;
}


function getRedisClient() {
  if (!redisClient) throw new Error('Redis not initialised. Call connectRedis() first.');
  return redisClient;
}

module.exports = { connectRedis, getRedisClient, KEYS };
