'use strict';

const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
    username: { type: String, required: true },   // denormalised for fast analytics
    gameName: { type: String, required: true },
    score:    { type: Number, required: true, min: 0 },
    isPersonalBest: { type: Boolean, default: false },
    sessionDuration: { type: Number, min: 0 },    // seconds
    metadata: {
      clientVersion: String,
      platform: { type: String, enum: ['web','mobile','desktop','api'] },
    },
  },
  {
    timestamps: true,
    toJSON: { transform(doc, ret) { delete ret.__v; return ret; } },
  }
);

// Core query patterns
scoreSchema.index({ userId: 1, gameId: 1, createdAt: -1 });
scoreSchema.index({ gameId: 1, score: -1, createdAt: -1 });
scoreSchema.index({ userId: 1, createdAt: -1 });
scoreSchema.index({ createdAt: -1 });

scoreSchema.statics.getTopScoresForGame = function (gameId, limit = 10) {
  return this.aggregate([
    { $match: { gameId: new mongoose.Types.ObjectId(gameId) } },
    { $sort:  { score: -1, createdAt: 1 } },
    { $group: { _id: '$userId', bestScore: { $first: '$score' }, username: { $first: '$username' }, achievedAt: { $first: '$createdAt' } } },
    { $sort:  { bestScore: -1 } },
    { $limit: limit },
  ]);
};

module.exports = mongoose.model('Score', scoreSchema);
