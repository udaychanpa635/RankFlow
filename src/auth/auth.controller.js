'use strict';

const { validationResult } = require('express-validator');
const authService = require('./auth.service');
const { success, created } = require('../common/response');
const { ValidationError }  = require('../common/errorHandler');

class AuthController {
  async register(req, res, next) {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) throw new ValidationError(errs.array().map(e => ({ field: e.path, message: e.msg })));

      const { user, token } = await authService.register(req.body);
      return created(res, { user, token }, 'Registration successful');
    } catch (err) { next(err); }
  }

  async login(req, res, next) {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) throw new ValidationError(errs.array().map(e => ({ field: e.path, message: e.msg })));

      const { user, token } = await authService.login(req.body);
      return success(res, { user, token }, 'Login successful');
    } catch (err) { next(err); }
  }

  async getProfile(req, res, next) {
    try {
      const user = await authService.getProfile(req.userId);
      return success(res, { user }, 'Profile retrieved');
    } catch (err) { next(err); }
  }
}

module.exports = new AuthController();
