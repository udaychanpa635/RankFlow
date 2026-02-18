'use strict';

const mongoose = require('mongoose');
const logger = require('../common/logger');

async function connectMongoDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set in .env');

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected',    () => logger.info('✅ MongoDB connected'));
  mongoose.connection.on('error',   (e) => logger.error('MongoDB error:', e));
  mongoose.connection.on('disconnected', () => logger.warn('⚠️  MongoDB disconnected'));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  return mongoose.connection;
}

module.exports = { connectMongoDB };
