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
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing in environment variables");
  }

  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
  });

  redisClient.on("connect", () => logger.info("✅ Redis connected"));
  redisClient.on("ready", () => logger.info("🚀 Redis ready"));
  redisClient.on("error", (err) => logger.error("❌ Redis error:", err.message));
  redisClient.on("reconnecting", () => logger.info("🔄 Redis reconnecting…"));

  await redisClient.ping();
  return redisClient;
}




function getRedisClient() {
  if (!redisClient) throw new Error('Redis not initialised. Call connectRedis() first.');
  return redisClient;
}

module.exports = { connectRedis, getRedisClient, KEYS };
