'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');

/**
 * src/config/rateLimiter.js
 *
 * Centralised rate-limit definitions.
 *
 * In development the in-memory store is used automatically (no Redis needed).
 * In production a RedisStore is used so limits are shared across all app nodes.
 *
 * Tiers
 * ──────────────────────────────────────────────────────────────────
 *  globalLimiter      100 req / 15 min  – every API route
 *  authLimiter         10 req / 15 min  – /auth/register, /auth/login
 *  scoreLimiter        30 req / 15 min  – POST /scores  (per user-id)
 *  leaderboardLimiter 200 req / 15 min  – GET /leaderboard/* (read-heavy, looser)
 *  reportLimiter       20 req / 15 min  – GET /reports/*  (aggregation-heavy)
 * ──────────────────────────────────────────────────────────────────
 */

function makeStore(client, prefix) {
  if (!client || process.env.NODE_ENV === 'test') return undefined; // use memory store in tests
  return new RedisStore({
    sendCommand: (...args) => client.call(...args),
    prefix,
  });
}

/**
 * Call once after Redis is connected to wire up Redis-backed stores.
 * Until then every limiter falls back to the in-process memory store.
 */
function buildLimiters(redisClient) {
  // ── 1. Global ─────────────────────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,   // RateLimit-* headers (RFC draft-7)
    legacyHeaders: false,    // drop X-RateLimit-* legacy headers
    store: makeStore(redisClient, 'rl:global:'),
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: '15 minutes',
    },
    skip: (req) => req.path === '/health', // never throttle health checks
  });

  // ── 2. Auth – brute-force protection ──────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(redisClient, 'rl:auth:'),
    message: {
      success: false,
      message: 'Too many authentication attempts. Try again in 15 minutes.',
    },
    // Penalise only on failed attempts (4xx). Success resets the counter.
    skipSuccessfulRequests: true,
  });

  // ── 3. Score submission – per user-id (not per IP) ────────────────────────
  const scoreLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(redisClient, 'rl:score:'),
    // Key by authenticated user-id so different users on the same IP
    // don't share a bucket (e.g. school / office NAT).
    keyGenerator: (req) => req.userId || req.ip,
    message: {
      success: false,
      message: 'Score submission limit reached (30/15 min). Slow down!',
    },
  });

  // ── 4. Leaderboard reads – looser because served mostly from Redis ─────────
  const leaderboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(redisClient, 'rl:lb:'),
    message: {
      success: false,
      message: 'Leaderboard request limit reached. Please slow down.',
    },
  });

  // ── 5. Reports – expensive aggregation queries ─────────────────────────────
  const reportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(redisClient, 'rl:report:'),
    message: {
      success: false,
      message: 'Report request limit reached (20/15 min). Please try again later.',
    },
  });

  return { globalLimiter, authLimiter, scoreLimiter, leaderboardLimiter, reportLimiter };
}

module.exports = { buildLimiters };
