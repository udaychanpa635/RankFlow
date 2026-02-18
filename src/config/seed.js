'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../users/user.model');
const Game     = require('../scores/game.model');
const Score    = require('../scores/score.model');
const leaderboardService = require('../leaderboard/leaderboard.service');
const { connectMongoDB } = require('./database');
const { connectRedis }   = require('./redis');

const GAMES = [
  { name: 'Space Blaster', slug: 'space-blaster', category: 'arcade',  maxScore: 999999 },
  { name: 'Puzzle Master',  slug: 'puzzle-master',  category: 'puzzle',  maxScore: 100000 },
  { name: 'Speed Racer',    slug: 'speed-racer',    category: 'racing',  maxScore: 50000  },
  { name: 'Dragon Quest',   slug: 'dragon-quest',   category: 'rpg',     maxScore: 500000 },
];

const USERS = [
  { username: 'ProGamer99', email: 'pro@example.com',    password: 'Password123' },
  { username: 'SpeedDemon', email: 'speed@example.com',  password: 'Password123' },
  { username: 'PuzzlePro',  email: 'puzzle@example.com', password: 'Password123' },
  { username: 'AcePlayer',  email: 'ace@example.com',    password: 'Password123' },
  { username: 'NewPlayer',  email: 'new@example.com',    password: 'Password123' },
];

async function seed() {
  console.log('🌱 Seeding database…');
  await connectMongoDB();
  await connectRedis();

  await Promise.all([User.deleteMany({}), Game.deleteMany({}), Score.deleteMany({})]);
  console.log('  ✓ Cleared existing data');

  const games = await Game.insertMany(GAMES);
  const users = await User.insertMany(USERS);
  console.log(`  ✓ Created ${games.length} games, ${users.length} users`);

  const scores = [];
  for (const user of users) {
    for (const game of games) {
      const n = Math.floor(Math.random() * 8) + 2;
      for (let i = 0; i < n; i++) {
        scores.push({
          userId:   user._id,
          gameId:   game._id,
          username: user.username,
          gameName: game.name,
          score:    Math.floor(Math.random() * game.maxScore * 0.8),
          createdAt: new Date(Date.now() - Math.random() * 7 * 86400 * 1000),
        });
      }
    }
  }
  await Score.insertMany(scores);
  console.log(`  ✓ Created ${scores.length} scores`);

  const rebuilt = await leaderboardService.rebuildFromMongo(Score);
  console.log(`  ✓ Redis leaderboard rebuilt (${rebuilt} entries)`);

  console.log('\n✨ Seed complete!');
  console.log('   Login: pro@example.com / Password123\n');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
