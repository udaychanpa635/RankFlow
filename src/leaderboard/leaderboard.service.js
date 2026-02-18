'use strict';

const { getRedisClient, KEYS } = require('../config/redis');
const logger = require('../common/logger');

class LeaderboardService {
  get redis() { return getRedisClient(); }

  formatMember(userId, username) { return `${userId}:${username}`; }
  parseMember(member) {
    const i = member.indexOf(':');
    return { userId: member.substring(0, i), username: member.substring(i + 1) };
  }

  // Date helpers
  getDateKey() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
  getWeekKey() {
    const d = new Date();
    const wk = Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);
    return `${d.getFullYear()}${String(wk).padStart(2, '0')}`;
  }

  /**
   * ZADD GT – only store if new score is higher than the current stored score.
   * Four sorted sets updated atomically in one pipeline.
   */
  async submitScore(userId, username, gameId, score) {
    const member = this.formatMember(userId, username);
    const today  = this.getDateKey();
    const week   = this.getWeekKey();

    const pl = this.redis.pipeline();
    pl.zadd(KEYS.globalLeaderboard(),          'GT', 'CH', score, member);
    pl.zadd(KEYS.gameLeaderboard(gameId),      'GT', 'CH', score, member);
    pl.zadd(KEYS.dailyLeaderboard(today),      'GT', 'CH', score, member);
    pl.expire(KEYS.dailyLeaderboard(today),  172800);   // 2 days
    pl.zadd(KEYS.weeklyLeaderboard(week),      'GT', 'CH', score, member);
    pl.expire(KEYS.weeklyLeaderboard(week),  864000);   // 10 days
    await pl.exec();

    const rankInfo = await this.getUserRank(userId, username);
    logger.info(`Leaderboard: user=${userId} game=${gameId} score=${score} rank=${rankInfo.globalRank}`);
    return rankInfo;
  }

  /** O(log N + M) – paginated global leaderboard from Redis */
  async getGlobalLeaderboard({ page = 1, limit = 10 } = {}) {
    const start = (page - 1) * limit;
    const [raw, total] = await Promise.all([
      this.redis.zrevrange(KEYS.globalLeaderboard(), start, start + limit - 1, 'WITHSCORES'),
      this.redis.zcard(KEYS.globalLeaderboard()),
    ]);
    return { entries: this.parse(raw, start), total, page, limit };
  }

  /** O(log N + M) – paginated game leaderboard */
  async getGameLeaderboard(gameId, { page = 1, limit = 10 } = {}) {
    const start = (page - 1) * limit;
    const [raw, total] = await Promise.all([
      this.redis.zrevrange(KEYS.gameLeaderboard(gameId), start, start + limit - 1, 'WITHSCORES'),
      this.redis.zcard(KEYS.gameLeaderboard(gameId)),
    ]);
    return { entries: this.parse(raw, start), total, page, limit };
  }

  /** O(log N) – user rank + surrounding players */
  async getUserRank(userId, username) {
    const member = this.formatMember(userId, username);
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(KEYS.globalLeaderboard(), member),
      this.redis.zscore(KEYS.globalLeaderboard(), member),
    ]);
    if (rank === null) return { ranked: false, message: 'No scores submitted yet' };

    const surrounding = await this.getSurrounding(rank);
    return { ranked: true, userId, username, globalRank: rank + 1, globalScore: parseFloat(score), surrounding };
  }

  async getUserGameRank(userId, username, gameId) {
    const member = this.formatMember(userId, username);
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(KEYS.gameLeaderboard(gameId), member),
      this.redis.zscore(KEYS.gameLeaderboard(gameId), member),
    ]);
    if (rank === null) return { ranked: false };
    return { ranked: true, userId, username, gameId, rank: rank + 1, score: parseFloat(score) };
  }

  async getSurrounding(rankIndex, radius = 2) {
    const start = Math.max(0, rankIndex - radius);
    const raw   = await this.redis.zrevrange(KEYS.globalLeaderboard(), start, rankIndex + radius, 'WITHSCORES');
    return this.parse(raw, start);
  }

  async getDailyLeaderboard(date, { limit = 10 } = {}) {
    const raw = await this.redis.zrevrange(KEYS.dailyLeaderboard(date || this.getDateKey()), 0, limit - 1, 'WITHSCORES');
    return this.parse(raw, 0);
  }

  async getWeeklyLeaderboard({ limit = 10 } = {}) {
    const raw = await this.redis.zrevrange(KEYS.weeklyLeaderboard(this.getWeekKey()), 0, limit - 1, 'WITHSCORES');
    return this.parse(raw, 0);
  }

  /** Flat [member, score, member, score…] → array of rank objects */
  parse(raw, startRank = 0) {
    const out = [];
    for (let i = 0; i < raw.length; i += 2) {
      const { userId, username } = this.parseMember(raw[i]);
      out.push({ rank: startRank + i / 2 + 1, userId, username, score: parseFloat(raw[i + 1]) });
    }
    return out;
  }

  /** Rebuild Redis from MongoDB after a cache flush */
  async rebuildFromMongo(Score) {
    logger.info('Rebuilding Redis from MongoDB…');
    const bests = await Score.aggregate([
      { $sort: { score: -1 } },
      { $group: { _id: { userId: '$userId', gameId: '$gameId' }, bestScore: { $max: '$score' }, username: { $first: '$username' } } },
    ]);

    const pl = this.redis.pipeline();
    for (const e of bests) {
      const m = this.formatMember(e._id.userId.toString(), e.username);
      pl.zadd(KEYS.globalLeaderboard(), 'GT', e.bestScore, m);
      pl.zadd(KEYS.gameLeaderboard(e._id.gameId.toString()), 'GT', e.bestScore, m);
    }
    await pl.exec();
    logger.info(`Redis rebuilt: ${bests.length} entries`);
    return bests.length;
  }
}

module.exports = new LeaderboardService();
