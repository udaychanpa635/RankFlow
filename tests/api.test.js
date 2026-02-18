'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const { createApp }      = require('../src/app');
const { connectMongoDB } = require('../src/config/database');
const { connectRedis, getRedisClient } = require('../src/config/redis');
const User  = require('../src/users/user.model');
const Game  = require('../src/scores/game.model');
const Score = require('../src/scores/score.model');

// Use in-memory limiters (no Redis needed for rate-limit store in tests)
const app = createApp({});

let token, userId, gameId;

beforeAll(async () => {
  process.env.MONGO_URI  = 'mongodb://localhost:27017/leaderboard_test';
  process.env.REDIS_HOST = 'localhost';
  process.env.JWT_SECRET = 'test-secret';
  await connectMongoDB();
  await connectRedis();

  await Game.deleteMany({});
  const game = await Game.create({ name: 'Test Game', slug: 'test-game', category: 'arcade', maxScore: 10000 });
  gameId = game._id.toString();
});

afterAll(async () => {
  await User.deleteMany({ email: /@jest\.test$/ });
  await Score.deleteMany({ gameName: 'Test Game' });
  await Game.findByIdAndDelete(gameId);
  await mongoose.connection.close();
  await getRedisClient().quit();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
describe('Auth', () => {
  it('POST /auth/register → 201', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'JestPlayer', email: 'jest@jest.test', password: 'Password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
    token  = res.body.data.token;
    userId = res.body.data.user._id;
  });

  it('POST /auth/register duplicate email → 409', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'Other', email: 'jest@jest.test', password: 'Password123',
    });
    expect(res.status).toBe(409);
  });

  it('POST /auth/login valid → 200', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'jest@jest.test', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('POST /auth/login wrong password → 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'jest@jest.test', password: 'Wrong1234' });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me → 200', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('JestPlayer');
  });
});

// ── Scores ────────────────────────────────────────────────────────────────────
describe('Scores', () => {
  it('POST /scores → 201 personal best', async () => {
    const res = await request(app).post('/api/v1/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId, score: 5000 });
    expect(res.status).toBe(201);
    expect(res.body.data.isPersonalBest).toBe(true);
    expect(res.body.data.rank.ranked).toBe(true);
  });

  it('POST /scores exceeds maxScore → 400', async () => {
    const res = await request(app).post('/api/v1/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId, score: 99999 });
    expect(res.status).toBe(400);
  });

  it('POST /scores no auth → 401', async () => {
    const res = await request(app).post('/api/v1/scores').send({ gameId, score: 1000 });
    expect(res.status).toBe(401);
  });

  it('GET /scores/history/:userId → 200', async () => {
    const res = await request(app).get(`/api/v1/scores/history/${userId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.scores)).toBe(true);
  });
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
describe('Leaderboard', () => {
  it('GET /leaderboard/global → 200', async () => {
    const res = await request(app).get('/api/v1/leaderboard/global');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /leaderboard/global?limit=5 respects limit', async () => {
    const res = await request(app).get('/api/v1/leaderboard/global?limit=5');
    expect(res.body.pagination.limit).toBe(5);
  });

  it('GET /leaderboard/game/:gameId → 200', async () => {
    const res = await request(app).get(`/api/v1/leaderboard/game/${gameId}`);
    expect(res.status).toBe(200);
  });

  it('GET /leaderboard/rank/:userId → 200 ranked', async () => {
    const res = await request(app).get(`/api/v1/leaderboard/rank/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ranked).toBe(true);
    expect(res.body.data.globalRank).toBeGreaterThanOrEqual(1);
  });
});

// ── Reports ───────────────────────────────────────────────────────────────────
describe('Reports', () => {
  it('GET /reports/top-players?period=all → 200', async () => {
    const res = await request(app).get('/api/v1/reports/top-players?period=all&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.topPlayers)).toBe(true);
  });

  it('GET /reports/top-players invalid period → 400', async () => {
    const res = await request(app).get('/api/v1/reports/top-players?period=yearly');
    expect(res.status).toBe(400);
  });

  it('GET /reports/games → 200', async () => {
    const res = await request(app).get('/api/v1/reports/games');
    expect(res.status).toBe(200);
  });
});

// ── Health ────────────────────────────────────────────────────────────────────
describe('Health', () => {
  it('GET /health → 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
