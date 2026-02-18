'use strict';

const leaderboardService = require('./leaderboard.service');
const User   = require('../users/user.model');
const { success, paginated } = require('../common/response');
const { NotFoundError }      = require('../common/errorHandler');

class LeaderboardController {
  async getGlobalLeaderboard(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 10);
      const result = await leaderboardService.getGlobalLeaderboard({ page, limit });
      return paginated(res, { data: { leaderboard: result.entries }, total: result.total, page, limit, message: 'Global leaderboard' });
    } catch (err) { next(err); }
  }

  async getGameLeaderboard(req, res, next) {
    try {
      const { gameId } = req.params;
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 10);
      const result = await leaderboardService.getGameLeaderboard(gameId, { page, limit });
      return paginated(res, { data: { leaderboard: result.entries, gameId }, total: result.total, page, limit, message: 'Game leaderboard' });
    } catch (err) { next(err); }
  }

  async getUserRank(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId).select('username stats');
      if (!user) throw new NotFoundError('User');
      const rankInfo = await leaderboardService.getUserRank(userId, user.username);
      return success(res, { ...rankInfo, stats: user.stats }, 'User rank retrieved');
    } catch (err) { next(err); }
  }

  async getDailyLeaderboard(req, res, next) {
    try {
      const limit   = Math.min(50, parseInt(req.query.limit) || 10);
      const entries = await leaderboardService.getDailyLeaderboard(req.query.date, { limit });
      return success(res, { leaderboard: entries, period: req.query.date || 'today' }, 'Daily leaderboard');
    } catch (err) { next(err); }
  }

  async getWeeklyLeaderboard(req, res, next) {
    try {
      const limit   = Math.min(50, parseInt(req.query.limit) || 10);
      const entries = await leaderboardService.getWeeklyLeaderboard({ limit });
      return success(res, { leaderboard: entries, period: 'current_week' }, 'Weekly leaderboard');
    } catch (err) { next(err); }
  }
}

module.exports = new LeaderboardController();
