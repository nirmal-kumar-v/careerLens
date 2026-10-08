const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log(`[STARTUP] Loaded .env file from: ${path.resolve(__dirname, '../.env')}`);
if (process.env.MONGODB_URI) {
  console.log(`[STARTUP] MONGODB_URI variable exists (Length: ${process.env.MONGODB_URI.length})`);
} else {
  console.log('[STARTUP] ERROR: MONGODB_URI variable is NOT set!');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectMongoDB, getMongoStatus, getDbDetails } = require('./config/mongodb');
const { connectPostgreSQL } = require('./config/postgresql');
const { logAiConfiguration } = require('./services/aiProvider');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const placementRoutes = require('./routes/placement');
const analysisRoutes = require('./routes/analysis');
const proofRoutes = require('./routes/proof');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & CORS
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = [
  'http://localhost:5175',
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check exact allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any localhost/127.0.0.1 port in development
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocal) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/placement', placementRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/proof', proofRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const dbInfo = getDbDetails();
  res.json({
    status: 'ok',
    mongodb: {
      connected: dbInfo.connected,
      databaseName: dbInfo.databaseName,
      readyState: dbInfo.readyState,
      userCollection: 'users'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Start
async function startServer() {
  logAiConfiguration();
  try {
    await connectMongoDB();
    console.log(`MongoDB connected successfully`);
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
  }

  try {
    await connectPostgreSQL();
    console.log('PostgreSQL connected');
  } catch (err) {
    console.warn('PostgreSQL connection failed:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`CareerLens backend running on port ${PORT}`);
  });
}

startServer();
