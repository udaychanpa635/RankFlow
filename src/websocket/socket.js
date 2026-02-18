'use strict';

const { Server } = require('socket.io');
const { verifyToken } = require('../auth/auth.middleware');
const logger = require('../common/logger');

let io = null;

function initWebSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST'] },
    pingInterval: 25000,
    pingTimeout:  5000,
    transports: ['websocket','polling'],
  });

  // Optional JWT auth
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const decoded = verifyToken(token);
        socket.userId    = decoded.sub;
        socket.username  = decoded.username;
        socket.authenticated = true;
      } else {
        socket.authenticated = false;
      }
    } catch { socket.authenticated = false; }
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`WS connected: ${socket.id} auth=${socket.authenticated}`);

    if (socket.authenticated) socket.join(`user:${socket.userId}`);

    socket.on('subscribe:global',      ()       => { socket.join('leaderboard:global'); socket.emit('subscribed', { room: 'leaderboard:global' }); });
    socket.on('subscribe:game',        (gameId) => { socket.join(`leaderboard:game:${gameId}`); socket.emit('subscribed', { room: `leaderboard:game:${gameId}` }); });
    socket.on('unsubscribe:game',      (gameId) => socket.leave(`leaderboard:game:${gameId}`));

    socket.on('request:leaderboard', async ({ type = 'global', gameId, page = 1, limit = 10 }) => {
      try {
        const svc  = require('../leaderboard/leaderboard.service');
        const data = type === 'game' && gameId
          ? await svc.getGameLeaderboard(gameId, { page, limit })
          : await svc.getGlobalLeaderboard({ page, limit });
        socket.emit('leaderboard:snapshot', { type, gameId, ...data, timestamp: new Date().toISOString() });
      } catch { socket.emit('error', { message: 'Failed to fetch leaderboard' }); }
    });

    socket.on('ping',       () => socket.emit('pong', { timestamp: Date.now() }));
    socket.on('disconnect', (reason) => logger.info(`WS disconnected: ${socket.id} (${reason})`));
  });

  logger.info('✅ WebSocket server ready');
  return io;
}

function getWebSocketServer() { return io; }

module.exports = { initWebSocket, getWebSocketServer };
