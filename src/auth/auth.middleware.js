'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../users/user.model');
const { AuthError } = require('../common/errorHandler');

const SECRET     = process.env.JWT_SECRET || 'dev-secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN, issuer: 'leaderboard-api' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET, { issuer: 'leaderboard-api' });
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AuthError('No token provided');

    const decoded = verifyToken(header.split(' ')[1]);
    const user    = await User.findById(decoded.sub).select('+isActive');

    if (!user || !user.isActive) throw new AuthError('Account not found or deactivated');

    req.user   = user;
    req.userId = user._id.toString();
    next();
  } catch (err) {
    next(err instanceof AuthError ? err : new AuthError(err.message));
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = verifyToken(header.split(' ')[1]);
      const user    = await User.findById(decoded.sub);
      if (user) { req.user = user; req.userId = user._id.toString(); }
    }
  } catch { /* ignore */ }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new AuthError('Admin access required'));
  next();
}

module.exports = { signToken, verifyToken, authenticate, optionalAuth, requireAdmin };
