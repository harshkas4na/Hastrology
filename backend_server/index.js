require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const { getConfig, validateEnv } = require('./src/config/environment');
const { testConnection } = require('./src/config/supabase');
const logger = require('./src/config/logger');
const requestLogger = require('./src/middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const routes = require('./src/routes');

/**
 * Initialize Express application
 */
const app = express();

/**
 * Validate environment variables on startup
 */
try {
  validateEnv();
  logger.info('Environment variables validated successfully');
} catch (error) {
  logger.error('Environment validation failed:', error.message);
  process.exit(1);
}

const config = getConfig();

/**
 * Security middleware
 */
app.use(helmet()); // Security headers
app.use(compression()); // Response compression

/**
 * CORS configuration
 */
const corsOptions = {
  origin: config.cors.allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request logging
 */
if (config.server.isDevelopment) {
  app.use(requestLogger);
}

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Hastrology Backend API',
    version: '2.0.0',
    environment: config.server.nodeEnv
  });
});

/**
 * Mount API routes
 */
app.use('/api', routes);

/**
 * Error handling
 */
app.use(notFoundHandler); // 404 handler
app.use(errorHandler); // Global error handler

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Test database connection
    logger.info('Testing Supabase connection...');
    const isConnected = await testConnection();

    if (!isConnected) {
      logger.warn('Supabase connection test failed, but continuing...');
      logger.warn('Make sure to run the schema.sql in your Supabase project');
    } else {
      logger.info('✓ Supabase connection successful');
    }

    // Start listening
    const PORT = config.server.port;
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Environment: ${config.server.nodeEnv}`);
      logger.info(`🔗 API available at: http://localhost:${PORT}/api`);

      if (config.server.isDevelopment) {
        logger.info('💡 Development mode - detailed logging enabled');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server (skip on Vercel - it uses the exported app directly)
if (!process.env.VERCEL) {
  startServer();
}

module.exports = app; // Export for Vercel serverless + testing