db = db.getSiblingDB('leaderboard_db');

db.createCollection('users');
db.createCollection('scores');
db.createCollection('games');

db.users.createIndex({ email: 1 },    { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.scores.createIndex({ userId: 1, gameId: 1, createdAt: -1 });
db.scores.createIndex({ gameId: 1, score: -1 });
db.games.createIndex({ slug: 1 }, { unique: true });

db.games.insertMany([
  { name: 'Space Blaster', slug: 'space-blaster', category: 'arcade',  maxScore: 999999, isActive: true, totalPlays: 0, createdAt: new Date() },
  { name: 'Puzzle Master',  slug: 'puzzle-master',  category: 'puzzle',  maxScore: 100000, isActive: true, totalPlays: 0, createdAt: new Date() },
  { name: 'Speed Racer',    slug: 'speed-racer',    category: 'racing',  maxScore: 50000,  isActive: true, totalPlays: 0, createdAt: new Date() },
]);

print('✅ MongoDB initialised');
