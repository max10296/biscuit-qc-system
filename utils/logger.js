/**
 * Comprehensive Logging System
 * Provides structured logging with different levels and outputs
 */

const fs = require('fs').promises;
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
  4: 'TRACE'
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level?.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? true;
    this.logDir = options.logDir || path.join(__dirname, '../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.service = options.service || 'biscuit-qc';
    
    // Ensure log directory exists
    this._ensureLogDirectory();
    
    // Cleanup old logs periodically
    this._scheduleLogCleanup();
  }

  async _ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  _scheduleLogCleanup() {
    // Clean up old logs every hour
    setInterval(() => {
      this._cleanupOldLogs().catch(error => {
        console.error('Log cleanup failed:', error);
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  async _cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stat: null
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          // File might have been deleted, skip it
          continue;
        }
      }

      // Sort by modification time (oldest first)
      logFiles
        .filter(file => file.stat)
        .sort((a, b) => a.stat.mtime - b.stat.mtime);

      // Remove excess files
      const filesToDelete = logFiles.slice(0, -this.maxFiles);
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`Deleted old log file: ${file.name}`);
        } catch (error) {
          console.error(`Failed to delete log file ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Log cleanup error:', error);
    }
  }

  _formatLogEntry(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logLevel = LOG_LEVEL_NAMES[level];
    
    const logEntry = {
      timestamp,
      level: logLevel,
      service: this.service,
      message,
      ...meta
    };

    // Add stack trace for errors
    if (level === LOG_LEVELS.ERROR && meta.error instanceof Error) {
      logEntry.stack = meta.error.stack;
      logEntry.error = {
        name: meta.error.name,
        message: meta.error.message
      };
    }

    return logEntry;
  }

  _getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return `${this.service}-${date}.log`;
  }

  async _writeToFile(logEntry) {
    if (!this.enableFile) return;

    try {
      const fileName = this._getLogFileName();
      const filePath = path.join(this.logDir, fileName);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Check file size and rotate if necessary
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > this.maxFileSize) {
          const rotatedName = `${this.service}-${Date.now()}.log`;
          const rotatedPath = path.join(this.logDir, rotatedName);
          await fs.rename(filePath, rotatedPath);
        }
      } catch (error) {
        // File doesn't exist yet, which is fine
      }

      await fs.appendFile(filePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  _writeToConsole(logEntry) {
    if (!this.enableConsole) return;

    const { timestamp, level, message, ...meta } = logEntry;
    const colorCodes = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m', // Magenta
      TRACE: '\x1b[90m'  // Bright Black (Gray)
    };
    const resetCode = '\x1b[0m';
    const color = colorCodes[level] || resetCode;
    
    const formattedTime = new Date(timestamp).toLocaleTimeString();
    const prefix = `${color}[${formattedTime}] ${level}${resetCode}`;
    
    if (Object.keys(meta).length === 0) {
      console.log(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`, meta);
    }
  }

  async _log(level, message, meta = {}) {
    if (level > this.level) return; // Skip if log level is too low

    const logEntry = this._formatLogEntry(level, message, meta);
    
    // Write to console
    this._writeToConsole(logEntry);
    
    // Write to file
    await this._writeToFile(logEntry);
  }

  error(message, meta = {}) {
    return this._log(LOG_LEVELS.ERROR, message, meta);
  }

  warn(message, meta = {}) {
    return this._log(LOG_LEVELS.WARN, message, meta);
  }

  info(message, meta = {}) {
    return this._log(LOG_LEVELS.INFO, message, meta);
  }

  debug(message, meta = {}) {
    return this._log(LOG_LEVELS.DEBUG, message, meta);
  }

  trace(message, meta = {}) {
    return this._log(LOG_LEVELS.TRACE, message, meta);
  }

  // Express middleware for request logging
  requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Log request
      this.info('HTTP Request', {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.headers['x-request-id']
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;
        
        this.info('HTTP Response', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          requestId: req.headers['x-request-id']
        });

        // Call original end method
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Database query logger
  queryLogger(query, params = [], executionTime = null) {
    const meta = {
      query: query.substring(0, 200), // Truncate long queries
      paramsCount: params.length,
      executionTime: executionTime ? `${executionTime}ms` : null
    };

    if (executionTime && executionTime > 1000) {
      this.warn('Slow database query', meta);
    } else {
      this.debug('Database query', meta);
    }
  }

  // Error handler for uncaught exceptions
  handleUncaughtException(error) {
    this.error('Uncaught Exception', {
      error,
      stack: error.stack
    });
  }

  // Error handler for unhandled promise rejections
  handleUnhandledRejection(reason, promise) {
    this.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack
    });
  }

  // Application lifecycle logging
  logStartup(config = {}) {
    this.info('Application starting', {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      environment: process.env.NODE_ENV,
      config: {
        port: config.port,
        database: config.database ? 'configured' : 'not configured'
      }
    });
  }

  logShutdown(signal) {
    this.info('Application shutting down', {
      signal,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  }
}

// Create default logger instance
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableFile: process.env.LOG_FILE !== 'false',
  service: process.env.SERVICE_NAME || 'biscuit-qc'
});

// Global error handlers
process.on('uncaughtException', (error) => {
  defaultLogger.handleUncaughtException(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  defaultLogger.handleUnhandledRejection(reason, promise);
});

// Graceful shutdown logging
process.on('SIGTERM', () => {
  defaultLogger.logShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  defaultLogger.logShutdown('SIGINT');
});

// Export both the class and default instance
module.exports = {
  Logger,
  logger: defaultLogger,
  LOG_LEVELS
};