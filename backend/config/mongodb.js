const mongoose = require('mongoose');

let isConnected = false;

async function connectMongoDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set in environment (.env)');
  }

  // Event handlers
  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log(`MongoDB connected successfully`);
    console.log(`  Database name: ${mongoose.connection.name}`);
    console.log(`  Host: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn(`MongoDB disconnected`);
  });

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  isConnected = true;
  return mongoose.connection;
}

function getMongoStatus() {
  return isConnected && mongoose.connection.readyState === 1;
}

function getDbDetails() {
  return {
    connected: getMongoStatus(),
    databaseName: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    readyState: mongoose.connection.readyState,
  };
}

module.exports = { connectMongoDB, getMongoStatus, getDbDetails };
