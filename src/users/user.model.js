'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, trim: true,
      minlength: 3, maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'],
    },
    email: {
      type: String, required: true, unique: true,
      trim: true, lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role:     { type: String, enum: ['player','admin'], default: 'player' },
    avatar:   { type: String, default: null },
    stats: {
      totalGamesPlayed: { type: Number, default: 0 },
      totalScore:       { type: Number, default: 0 },
      highestScore:     { type: Number, default: 0 },
      averageScore:     { type: Number, default: 0 },
      lastPlayedAt:     { type: Date,   default: null },
    },
    isActive:       { type: Boolean, default: true, select: false },
    lastLoginAt:    { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password; delete ret.isActive; delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ 'stats.totalScore': -1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.updateStats = async function (score, gameId) {
  this.stats.totalGamesPlayed += 1;
  this.stats.totalScore       += score;
  if (score > this.stats.highestScore) this.stats.highestScore = score;
  this.stats.averageScore = Math.round(this.stats.totalScore / this.stats.totalGamesPlayed);
  this.stats.lastPlayedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
