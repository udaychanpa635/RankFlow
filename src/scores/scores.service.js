'use strict';

const Score  = require('./score.model');
const Game   = require('./game.model');
const User   = require('../users/user.model');
const leaderboardService = require('../leaderboard/leaderboard.service');
const { getWebSocketServer } = require('../websocket/socket');
const { NotFoundError, AppError } = require('../common/errorHandler');
const logger = require('../common/logger');

class ScoresService {
  async submitScore(userId, { gameId, score, sessionDuration, metadata }) {
    const game = await Game.findById(gameId);
    if (!game)          throw new NotFoundError('Game');
    if (!game.isActive) throw new AppError('Game is not active', 400);
    if (game.maxScore && score > game.maxScore)
      throw new AppError(`Score exceeds maximum of ${game.maxScore}`, 400);

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    const prevBest     = await Score.findOne({ userId, gameId }).sort({ score: -1 });
    const isPersonalBest = !prevBest || score > prevBest.score;

    const scoreDoc = await Score.create({
      userId, gameId,
      username: user.username, gameName: game.name,
      score, isPersonalBest, sessionDuration, metadata,
    });

    const rankInfo = await leaderboardService.submitScore(userId, user.username, gameId, score);

    await user.updateStats(score, gameId);
    await Game.findByIdAndUpdate(gameId, { $inc: { totalPlays: 1 } });

    this._broadcast({ userId, username: user.username, gameId, gameName: game.name, score, rank: rankInfo.globalRank, isPersonalBest });

    logger.info(`Score: user=${userId} game=${gameId} score=${score} pb=${isPersonalBest}`);
    return { score: scoreDoc, isPersonalBest, rank: rankInfo };
  }

  async getScoreHistory(userId, { gameId, page = 1, limit = 20 } = {}) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    const filter = { userId, ...(gameId && { gameId }) };
    const [scores, total] = await Promise.all([
      Score.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('gameId', 'name slug category'),
      Score.countDocuments(filter),
    ]);
    return { scores, total, page, limit, user };
  }

  async getPersonalBests(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    const bests = await Score.aggregate([
      { $match: { userId: user._id } },
      { $sort: { score: -1 } },
      { $group: { _id: '$gameId', bestScore: { $first: '$score' }, gameName: { $first: '$gameName' }, achievedAt: { $first: '$createdAt' } } },
      { $sort: { bestScore: -1 } },
    ]);
    return { user, personalBests: bests };
  }

  _broadcast(data) {
    try {
      const io = getWebSocketServer();
      if (!io) return;
      const event = { type: 'SCORE_UPDATE', payload: data, timestamp: new Date().toISOString() };
      io.to('leaderboard:global').emit('score:update', event);
      io.to(`leaderboard:game:${data.gameId}`).emit('score:update', event);
    } catch (err) {
      logger.error('WS broadcast failed:', err.message);
    }
  }
}

module.exports = new ScoresService();
