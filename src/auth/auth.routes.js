'use strict';

const express = require('express');
const { body } = require('express-validator');
const authController = require('./auth.controller');
const { authenticate } = require('./auth.middleware');

const router = express.Router();

// Note: authLimiter is applied in app.js before this router mounts

router.post('/register',
  [
    body('username').trim().notEmpty().isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Letters, numbers, underscores only'),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Must include uppercase, lowercase and a number'),
  ],
  authController.register
);

router.post('/login',
  [
    body('email').trim().isEmail(),
    body('password').notEmpty(),
  ],
  authController.login
);

router.get('/me', authenticate, authController.getProfile);

module.exports = router;
