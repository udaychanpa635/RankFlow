'use strict';

const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    category:    { type: String, enum: ['arcade','puzzle','racing','strategy','sports','rpg','other'], default: 'other' },
    maxScore:    { type: Number, default: null },
    isActive:    { type: Boolean, default: true },
    totalPlays:  { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { transform(doc, ret) { delete ret.__v; return ret; } },
  }
);

gameSchema.index({ slug: 1 });
gameSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('Game', gameSchema);
