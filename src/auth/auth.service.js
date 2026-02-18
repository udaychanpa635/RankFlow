'use strict';

const User = require('../users/user.model');
const { signToken } = require('./auth.middleware');
const { AuthError, ConflictError, NotFoundError } = require('../common/errorHandler');

class AuthService {
  async register({ username, email, password }) {
    if (await User.findOne({ email }))    throw new ConflictError('Email already registered');
    if (await User.findOne({ username })) throw new ConflictError('Username already taken');

    const user  = await User.create({ username, email, password });
    const token = signToken({ sub: user._id.toString(), username: user.username, role: user.role });
    return { user, token };
  }

  async login({ email, password }) {
    const user = await User.findOne({ email, isActive: true }).select('+password +isActive');
    if (!user) throw new AuthError('Invalid email or password');

    const valid = await user.comparePassword(password);
    if (!valid) throw new AuthError('Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken({ sub: user._id.toString(), username: user.username, role: user.role });
    return { user, token };
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

module.exports = new AuthService();
