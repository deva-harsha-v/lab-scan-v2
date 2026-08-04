const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { getPool } = require('./src/config/db');
const logger = require('./src/utils/logger');
const Sentry = require("@sentry/node");

// Load environment variables
dotenv.config();

// Initialize Sentry for unhandled error tracking (gated behind SENTRY_DSN env var)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}

// Validate required environment variables on boot
const requiredEnvVars = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
const missingEnv = requiredEnvVars.filter(env => !process.env[env]);
if (missingEnv.length > 0) {
  logger.error(`FATAL: Missing required environment variables on boot: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Enforce JWT secrets check in production on boot
if (process.env.NODE_ENV === 'production') {
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtAccessSecret || jwtAccessSecret === 'supersecretaccesskey123!' || jwtAccessSecret.length < 32) {
    logger.error('FATAL: JWT_ACCESS_SECRET is missing, insecure, or too short in production!');
    process.exit(1);
  }
  if (!jwtRefreshSecret || jwtRefreshSecret === 'supersecretrefreshkey123!' || jwtRefreshSecret.length < 32) {
    logger.error('FATAL: JWT_REFRESH_SECRET is missing, insecure, or too short in production!');
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Security Headers & Cookie Parser
app.use(helmet());
app.use(cookieParser());

// Dynamic CORS configuration
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
let allowedOrigins = [];
if (allowedOriginsEnv) {
  allowedOrigins = allowedOriginsEnv.split(',').map(o => o.trim());
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const isDev = process.env.NODE_ENV !== 'production';
    if (allowedOrigins.includes(origin) || (isDev && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.use(express.json());

// CSRF Protection Middleware (Double-Submit Cookie Pattern)
app.use((req, res, next) => {
  const method = req.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const path = req.path;
  if (path === '/api/auth/login' || path === '/api/auth/refresh' || path === '/api/auth/logout') {
    return next();
  }

  const csrfCookie = req.cookies?.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'CSRF token validation failed.' });
  }

  next();
});

// Import routes
const authRoutes = require('./src/routes/auth');
const labRoutes = require('./src/routes/labs');
const experimentRoutes = require('./src/routes/experiments');
const sessionRoutes = require('./src/routes/sessions');
const auditRoutes = require('./src/routes/audit');
const branchRoutes = require('./src/routes/branches');
const institutionRoutes = require('./src/routes/institutions');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/institutions', institutionRoutes);

// Liveness check: confirms server is running
app.get('/health/live', (req, res) => {
  res.json({ status: 'live', timestamp: new Date() });
});

// Readiness check: verifies DB pool connection
app.get('/health/ready', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'connected', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', details: err.message });
  }
});

// Fallback /health endpoint pointing to readiness
app.get('/health', (req, res) => {
  res.redirect('/health/ready');
});

// Sentry Express error handler (gated behind process.env.SENTRY_DSN)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global unhandled error-catching middleware (prevents process crash & stack leaks)
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Forbidden: Request origin not allowed by CORS policy.' });
  }
  logger.error('Unhandled server error caught by middleware:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Start server after verifying DB connection
let server;
async function startServer() {
  try {
    logger.info('Verifying database pool...');
    getPool();
    logger.info('Database pool initialized.');

    server = app.listen(PORT, () => {
      logger.info(`LabScan REST API listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown on SIGTERM / SIGINT signals
const shutdown = () => {
  logger.info('Received termination signal. Starting graceful shutdown...');
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        const pool = getPool();
        await pool.end();
        logger.info('Postgres pool connection drained successfully. Exit code 0.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during pool draining:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
