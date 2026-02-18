'use strict';

const { validationResult } = require('express-validator');
const scoresService = require('./scores.service');
const { success, created, paginated } = require('../common/response');
const { ValidationError } = require('../common/errorHandler');

class ScoresController {
  async submitScore(req, res, next) {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) throw new ValidationError(errs.array().map(e => ({ field: e.path, message: e.msg })));

      const result = await scoresService.submitScore(req.userId, req.body);
      return created(res, result, result.isPersonalBest ? '🎉 New personal best!' : 'Score submitted');
    } catch (err) { next(err); }
  }

  async getScoreHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const page  = parseInt(req.query.page)  || 1;
      const limit = parseInt(req.query.limit) || 20;
      const result = await scoresService.getScoreHistory(userId, { gameId: req.query.gameId, page, limit });
      return paginated(res, { data: { scores: result.scores, user: result.user }, total: result.total, page, limit, message: 'Score history' });
    } catch (err) { next(err); }
  }

  async getPersonalBests(req, res, next) {
    try {
      const result = await scoresService.getPersonalBests(req.params.userId);
      return success(res, result, 'Personal bests retrieved');
    } catch (err) { next(err); }
  }
}

module.exports = new ScoresController();
