const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const apiRoutes = require('./routes/api');
const { securityMiddleware, rateLimitMiddleware } = require('./middleware/validation');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
    // السماح بتحميل مكتبات jspdf وخرائط المصدر
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"], 
    fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
    imgSrc: ["'self'", "data:", "https:"],
    // السماح بتحميل ملفات الصوت المشفرة بـ data:audio/wav
    mediaSrc: ["'self'", "data:", "blob:"], 
    connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"] 
  }
}

}));


// Compression middleware
app.use(compression());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Security and validation middleware
app.use(securityMiddleware);
app.use('/api/', rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 100
}));

// Request logging middleware
app.use(logger.requestLogger());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// API routes
app.use('/api', apiRoutes);

// Serve main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'reports.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message, timestamp: new Date().toISOString() });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error handler', {
    error: err,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    requestId: req.headers['x-request-id']
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Log application startup
    logger.logStartup({
      port: PORT,
      database: true
    });
    
    await db.initialize();
    logger.info('Database initialized successfully');
    
    app.listen(PORT, () => {
      logger.info(`Biscuit QC Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        healthCheck: `http://localhost:${PORT}/health`,
        databaseHealth: `http://localhost:${PORT}/health/db`,
        mainApplication: `http://localhost:${PORT}/`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  try {
    await db.close();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    await db.close();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});