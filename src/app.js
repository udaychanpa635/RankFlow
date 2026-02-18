'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const authRouter        = require('./auth/auth.routes');
const scoresRouter      = require('./scores/scores.routes');
const leaderboardRouter = require('./leaderboard/leaderboard.routes');
const reportsRouter     = require('./reports/reports.routes');

const { errorHandler, notFoundHandler } = require('./common/errorHandler');
const logger = require('./common/logger');

/**
 * createApp(limiters)
 *
 * Accepts the rate-limiter bundle built in server.js (after Redis is up).
 * This pattern lets tests call createApp({}) with empty limiters so they
 * never depend on Redis being available.
 */
function createApp(limiters = {}) {
  const {
    globalLimiter,
    authLimiter,
    scoreLimiter,
    leaderboardLimiter,
    reportLimiter,
  } = limiters;

  const app = express();

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', credentials: true }));

  // ── Body parsing ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ── HTTP logging ─────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream: { write: (m) => logger.http(m.trim()) } }));
  }

  // ── Health (exempt from all rate limits) ──────────────────────────────────────
  app.get('/health', async (req, res) => {
    const { getRedisClient } = require('./config/redis');
    const mongoose = require('mongoose');
    const checks   = {
      status: 'ok',
      uptime: process.uptime(),
      services: {
        mongodb: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
        redis:   'checking',
      },
    };
    try   { await getRedisClient().ping(); checks.services.redis = 'healthy'; }
    catch { checks.services.redis = 'unhealthy'; checks.status = 'degraded'; }
    res.status(checks.status === 'ok' ? 200 : 503).json(checks);
  });

  const API = process.env.API_PREFIX || '/api/v1';

  // ── Global rate limit (all /api/v1 routes) ───────────────────────────────────
  if (globalLimiter) app.use(API, globalLimiter);

  // ── Per-route rate limits ────────────────────────────────────────────────────
  //
  //  /auth/*        →  authLimiter      (10  req / 15 min)  brute-force guard
  //  POST /scores   →  scoreLimiter     (30  req / 15 min)  keyed by user-id
  //  /leaderboard/* →  leaderboardLimiter (200 req / 15 min)  read-heavy
  //  /reports/*     →  reportLimiter    (20  req / 15 min)  aggregation-heavy
  //
  if (authLimiter)        app.use(`${API}/auth`,        authLimiter);
  if (scoreLimiter)       app.use(`${API}/scores`,      scoreLimiter);
  if (leaderboardLimiter) app.use(`${API}/leaderboard`, leaderboardLimiter);
  if (reportLimiter)      app.use(`${API}/reports`,     reportLimiter);

  // ── Route mounting ───────────────────────────────────────────────────────────
  app.use(`${API}/auth`,        authRouter);
  app.use(`${API}/scores`,      scoresRouter);
  app.use(`${API}/leaderboard`, leaderboardRouter);
  app.use(`${API}/reports`,     reportsRouter);

  app.get(API, (req, res) =>
    res.json({ success: true, message: 'Real-Time Leaderboard API v1.0', endpoints: { auth: `${API}/auth`, scores: `${API}/scores`, leaderboard: `${API}/leaderboard`, reports: `${API}/reports` } })
  );

  // ── Error handling ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
