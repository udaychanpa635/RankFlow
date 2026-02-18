'use strict';

const express  = require('express');
const mongoose = require('mongoose');
const Score    = require('../scores/score.model');
const User     = require('../users/user.model');
const Game     = require('../scores/game.model');
const { success } = require('../common/response');
const { authenticate, requireAdmin } = require('../auth/auth.middleware');
const { AppError } = require('../common/errorHandler');

// reportLimiter is applied in app.js before this router mounts

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function periodMatch(period) {
  const now  = new Date();
  if (period === 'daily') {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { createdAt: { $gte: s } };
  }
  if (period === 'weekly') {
    const s = new Date(now); s.setDate(s.getDate() - 7);
    return { createdAt: { $gte: s } };
  }
  if (period === 'monthly') {
    const s = new Date(now); s.setMonth(s.getMonth() - 1);
    return { createdAt: { $gte: s } };
  }
  return {};
}

// ── routes ───────────────────────────────────────────────────────────────────

/** GET /api/v1/reports/top-players?period=weekly&limit=10 */
router.get('/top-players', async (req, res, next) => {
  try {
    const { period = 'all', limit = 10 } = req.query;
    const valid = ['daily','weekly','monthly','all'];
    if (!valid.includes(period)) throw new AppError(`period must be one of: ${valid.join(', ')}`, 400);

    const match = periodMatch(period);
    const players = await Score.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      { $group: {
          _id:          '$userId',
          username:     { $first: '$username' },
          totalScore:   { $sum: '$score' },
          bestScore:    { $max: '$score' },
          gamesPlayed:  { $sum: 1 },
          uniqueGames:  { $addToSet: '$gameId' },
          avgScore:     { $avg: '$score' },
          lastPlayed:   { $max: '$createdAt' },
      }},
      { $addFields: { uniqueGamesCount: { $size: '$uniqueGames' }, avgScore: { $round: ['$avgScore', 0] } } },
      { $sort: { totalScore: -1 } },
      { $limit: Math.min(100, parseInt(limit)) },
      { $project: { _id: 0, userId: '$_id', username: 1, totalScore: 1, bestScore: 1, gamesPlayed: 1, uniqueGamesCount: 1, avgScore: 1, lastPlayed: 1 } },
    ]);

    return success(res, { period, topPlayers: players, generatedAt: new Date() }, 'Top players report');
  } catch (err) { next(err); }
});

/** GET /api/v1/reports/games */
router.get('/games', async (req, res, next) => {
  try {
    const stats = await Score.aggregate([
      { $group: {
          _id:            '$gameId',
          gameName:       { $first: '$gameName' },
          totalPlays:     { $sum: 1 },
          uniquePlayers:  { $addToSet: '$userId' },
          avgScore:       { $avg: '$score' },
          maxScore:       { $max: '$score' },
      }},
      { $addFields: { uniquePlayerCount: { $size: '$uniquePlayers' }, avgScore: { $round: ['$avgScore', 0] } } },
      { $sort: { totalPlays: -1 } },
      { $project: { _id: 0, gameId: '$_id', gameName: 1, totalPlays: 1, uniquePlayerCount: 1, avgScore: 1, maxScore: 1 } },
    ]);
    return success(res, { games: stats, generatedAt: new Date() }, 'Game stats');
  } catch (err) { next(err); }
});

/** GET /api/v1/reports/user/:userId/activity  (own or admin) */
router.get('/user/:userId/activity', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.userId !== userId && req.user.role !== 'admin')
      throw new AppError('Not authorised', 403);

    const uid = mongoose.Types.ObjectId.createFromHexString(userId);
    const [user, activityByDay, gameBreakdown] = await Promise.all([
      User.findById(userId),
      Score.aggregate([
        { $match: { userId: uid, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, gamesPlayed: { $sum: 1 }, totalScore: { $sum: '$score' }, bestScore: { $max: '$score' } } },
        { $sort: { _id: 1 } },
      ]),
      Score.aggregate([
        { $match: { userId: uid } },
        { $group: { _id: '$gameId', gameName: { $first: '$gameName' }, gamesPlayed: { $sum: 1 }, bestScore: { $max: '$score' }, avgScore: { $avg: '$score' } } },
        { $addFields: { avgScore: { $round: ['$avgScore', 0] } } },
        { $sort: { bestScore: -1 } },
      ]),
    ]);

    return success(res, { user, activityByDay, gameBreakdown }, 'User activity report');
  } catch (err) { next(err); }
});

/** GET /api/v1/reports/summary  (admin only) */
router.get('/summary', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [totalUsers, totalGames, totalScores, last24h] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Game.countDocuments({ isActive: true }),
      Score.countDocuments(),
      Score.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 86400000) } } },
        { $group: { _id: null, count: { $sum: 1 }, totalScore: { $sum: '$score' } } },
      ]),
    ]);
    return success(res, { totalUsers, totalGames, totalScores, last24h: last24h[0] || { count: 0, totalScore: 0 }, generatedAt: new Date() }, 'Platform summary');
  } catch (err) { next(err); }
});

module.exports = router;
