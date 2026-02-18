'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const scoresController = require('./scores.controller');
const { authenticate } = require('../auth/auth.middleware');

// scoreLimiter is injected by app.js when the limiters are built
// It is applied only to POST / (score submission) – not to reads

const router = express.Router();

/**
 * POST /api/v1/scores
 * scoreLimiter is applied from app.js: app.use('/api/v1/scores', scoreLimiter, scoresRouter)
 */
router.post('/',
  authenticate,
  [
    body('gameId').notEmpty().isMongoId().withMessage('Valid gameId required'),
    body('score').notEmpty().isInt({ min: 0 }).withMessage('Score must be a non-negative integer'),
    body('sessionDuration').optional().isInt({ min: 0 }),
    body('metadata.platform').optional().isIn(['web','mobile','desktop','api']),
  ],
  scoresController.submitScore
);

router.get('/history/:userId',
  authenticate,
  [param('userId').isMongoId()],
  scoresController.getScoreHistory
);

router.get('/best/:userId',
  [param('userId').isMongoId()],
  scoresController.getPersonalBests
);

module.exports = router;
