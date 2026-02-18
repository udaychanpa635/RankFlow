# 🏆 Real-Time Leaderboard System

Node.js · Express · MongoDB · Redis · Socket.IO · JWT · Docker

---

## Quick Start

### Option A – Docker (zero setup)
```bash
cp .env .env.local          # already pre-filled for Docker
docker-compose up -d        # starts app + mongo + redis
docker-compose exec app npm run seed
open http://localhost:3000/api/v1
```

### Option B – Local (MongoDB + Redis already running)
```bash
npm install
npm run seed    
npm run dev     
```

Test credentials after seed: `pro@example.com / Password123`

---

## Rate Limits (per IP unless noted)

| Route              | Limit            | Store        | Notes                    |
|--------------------|------------------|--------------|--------------------------|
| All `/api/v1/*`    | 100 req / 15 min | Redis        | Global guard             |
| `POST /auth/*`     | 10  req / 15 min | Redis        | Brute-force protection   |
| `POST /scores`     | 30  req / 15 min | Redis by uid | Keyed by user-id, not IP |
| `GET /leaderboard` | 200 req / 15 min | Redis        | Read-heavy, looser cap   |
| `GET /reports`     | 20  req / 15 min | Redis        | Aggregation-heavy        |

Response headers on every reply:
```
RateLimit-Limit:     100
RateLimit-Remaining: 97
RateLimit-Reset:     1700000000
```

---

## API

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me                     🔒

POST   /api/v1/scores                      🔒
GET    /api/v1/scores/history/:userId      🔒
GET    /api/v1/scores/best/:userId

GET    /api/v1/leaderboard/global
GET    /api/v1/leaderboard/game/:gameId
GET    /api/v1/leaderboard/rank/:userId
GET    /api/v1/leaderboard/daily
GET    /api/v1/leaderboard/weekly

GET    /api/v1/reports/top-players?period=daily|weekly|monthly|all
GET    /api/v1/reports/games
GET    /api/v1/reports/user/:userId/activity  🔒
GET    /api/v1/reports/summary               🔒 admin

GET    /health
```

---

## WebSocket

```js
const socket = io('http://localhost:3000', { auth: { token } });

socket.emit('subscribe:global');
socket.emit('subscribe:game', gameId);

socket.on('score:update',        (e) => console.log(e));
socket.on('leaderboard:snapshot',(d) => console.log(d));
```

---

## Project Structure

```
src/
├── app.js                  ← Express factory, rate limiters wired here
├── server.js               ← Bootstrap: DB → Redis → limiters → listen
├── auth/
│   ├── auth.middleware.js  ← JWT sign/verify/authenticate
│   ├── auth.service.js
│   ├── auth.controller.js
│   └── auth.routes.js
├── scores/
│   ├── score.model.js
│   ├── game.model.js
│   ├── scores.service.js   ← submit flow: Mongo + Redis + WS broadcast
│   ├── scores.controller.js
│   └── scores.routes.js
├── leaderboard/
│   ├── leaderboard.service.js  ← ZADD GT, ZREVRANGE, ZREVRANK
│   ├── leaderboard.controller.js
│   └── leaderboard.routes.js
├── reports/
│   └── reports.routes.js   ← MongoDB aggregation pipelines
├── users/
│   └── user.model.js
├── websocket/
│   └── socket.js
└── config/
    ├── database.js
    ├── redis.js
    ├── rateLimiter.js      ← All 5 limiters defined here
    └── seed.js
```

---

## npm scripts

```bash
npm run dev          # development (nodemon)
npm start            # production
npm test             # jest integration tests
npm run seed         # populate sample data
npm run docker:up    # docker-compose up -d
npm run docker:down  # docker-compose down
```
