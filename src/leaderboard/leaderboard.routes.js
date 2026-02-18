'use strict';

const express = require('express');
const { param } = require('express-validator');
const leaderboardController = require('./leaderboard.controller');
const { optionalAuth } = require('../auth/auth.middleware');

// leaderboardLimiter is applied in app.js before this router mounts

const router = express.Router();

router.get('/global',  optionalAuth, leaderboardController.getGlobalLeaderboard);
router.get('/daily',                 leaderboardController.getDailyLeaderboard);
router.get('/weekly',                leaderboardController.getWeeklyLeaderboard);

router.get('/game/:gameId',
  [param('gameId').isMongoId()],
  leaderboardController.getGameLeaderboard
);

router.get('/rank/:userId',
  [param('userId').isMongoId()],
  leaderboardController.getUserRank
);

module.exports = router;
