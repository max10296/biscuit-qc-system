# 🍪 Enhanced Biscuit Quality Control System

A comprehensive, production-ready quality control system for biscuit manufacturing with advanced data storage, reporting, and analytics capabilities.

## 🚀 Recent Major Enhancements

This version includes a complete overhaul of the data storage and reporting system with enterprise-level features:

### ✨ New Features

- **📊 Advanced Analytics & Reporting**: Real-time dashboard data, comprehensive statistics, and performance metrics
- **🗄️ Enhanced Data Storage**: Optimized database schema with improved relationships and indexing
- **🔒 Security & Validation**: Input sanitization, rate limiting, and comprehensive security headers
- **📈 Performance Monitoring**: Database connection pooling, query optimization, and system health tracking
- **🔄 Migration System**: Database schema version control with rollback capabilities
- **📁 Data Export**: Multi-format data export with history tracking
- **🔍 Advanced Search**: Full-text search across products and reports
- **🔔 Notification System**: Alert management for quality issues and system events
- **📝 Comprehensive Logging**: Structured logging with multiple output formats
- **🛡️ Error Handling**: Robust error handling with detailed logging and user-friendly messages

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Features](#features)
- [Security](#security)
- [Migration System](#migration-system)
- [Monitoring](#monitoring)
- [Testing](#testing)
- [Deployment](#deployment)

## 🚀 Installation

### Prerequisites

- Node.js v16.0.0 or higher
- PostgreSQL 12+ database
- npm or yarn package manager

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd webapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database and application settings
   ```

4. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb biscuit_qc_db
   
   # Run schema setup
   psql biscuit_qc_db < database_schema_optimized.sql
   
   # Or use migration system
   node migrations/migration-system.js migrate
   ```

5. **Start the application**
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### Database Settings
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=biscuit_qc_db
DB_USER=postgres
DB_PASSWORD=123
DB_SSL=false
```

#### Application Settings
```env
NODE_ENV=development
PORT=3000
SERVICE_NAME=biscuit-qc-system
```

#### Security Settings
```env
ALLOWED_ORIGINS=http://localhost:3000
RATE_LIMIT_REQUESTS=100
ENABLE_SECURITY_HEADERS=true
```

#### Logging Settings
```env
LOG_LEVEL=INFO
LOG_CONSOLE=true
LOG_FILE=true
```

## 🗄️ Database Setup

### Schema Overview

The enhanced database schema includes:

- **Core Tables**: products, reports, signatures, settings
- **Analytics Tables**: report_aggregates, performance_metrics
- **System Tables**: notifications, data_exports, backup_metadata
- **Audit Tables**: audit_log, sessions

### Migration System

Use the built-in migration system for database updates:

```bash
# Check migration status
node migrations/migration-system.js status

# Run pending migrations
node migrations/migration-system.js migrate

# Create new migration
node migrations/migration-system.js create add_new_feature

# Rollback last migration (if rollback file exists)
node migrations/migration-system.js rollback
```

## 🌐 API Endpoints

### Enhanced Analytics & Reporting

#### Dashboard Data
```http
GET /api/analytics/dashboard?start_date=2024-01-01&end_date=2024-12-31
```
Returns comprehensive dashboard data including statistics, recent reports, alerts, and key metrics.

#### Report Analytics
```http
GET /api/analytics/reports?product_id=uuid&start_date=2024-01-01
```
Detailed report analytics with filtering and grouping options.

#### Performance Metrics
```http
GET /api/analytics/performance?metric_category=quality
```
System and quality performance metrics tracking.

### Data Export

#### Export Reports
```http
GET /api/export/reports?format=json&start_date=2024-01-01
```
Export report data in JSON, CSV, or other formats.

#### Export Products
```http
GET /api/export/products?format=csv&active=true
```
Export product configurations and specifications.

#### Export History
```http
GET /api/export/history
```
View export history and download previous exports.

### Advanced Search

#### Full-Text Search
```http
GET /api/search?q=batch&tables=reports,products&limit=50
```
Search across multiple tables with relevance ranking.

### Notifications

#### Get Notifications
```http
GET /api/notifications?unread_only=true&severity=warning
```
Retrieve system notifications and alerts.

#### Create Notification
```http
POST /api/notifications
Content-Type: application/json

{
  "notification_type": "quality_alert",
  "title": "Quality Issue Detected",
  "message": "Batch XYZ failed quality checks",
  "severity": "warning",
  "target_users": ["quality_manager", "supervisor"]
}
```

### System Monitoring

#### Performance Monitoring
```http
GET /api/system/performance
```
Database connection pool status, memory usage, and system health.

#### Database Maintenance
```http
POST /api/system/maintenance
```
Trigger database maintenance tasks (cleanup, statistics update).

#### Backup Management
```http
GET /api/system/backup
POST /api/system/backup
```
Backup metadata and creation endpoints.

### Legacy Endpoints (Enhanced)

All existing endpoints have been enhanced with:
- Improved error handling
- Better validation
- Performance optimizations
- Comprehensive logging

## 🔒 Security Features

### Input Validation & Sanitization
- **XSS Prevention**: HTML encoding and script tag filtering
- **SQL Injection Protection**: Parameterized queries and input escaping
- **Data Type Validation**: Strict type checking and format validation
- **Business Rule Validation**: Custom validation rules per entity type

### Rate Limiting
- **API Protection**: Configurable rate limits per IP address
- **Sliding Window**: 15-minute rolling window with customizable limits
- **Development Mode**: Higher limits for development environments

### Security Headers
- **X-Content-Type-Options**: Prevent MIME type sniffing
- **X-Frame-Options**: Clickjacking protection
- **X-XSS-Protection**: Browser XSS filtering
- **CORS**: Configurable cross-origin resource sharing

## 📊 Features

### Real-Time Analytics
- **Live Dashboard**: Real-time quality metrics and KPIs
- **Trend Analysis**: Historical data analysis and pattern detection
- **Performance Tracking**: Production efficiency and quality trends
- **Alert System**: Automated notifications for quality issues

### Data Management
- **Bulk Operations**: Import/export large datasets efficiently
- **Data Versioning**: Track changes with comprehensive audit trails
- **Backup System**: Automated and manual backup capabilities
- **Data Retention**: Configurable retention policies

### Quality Control
- **Multi-Product Support**: Handle various biscuit types and configurations
- **Batch Tracking**: Complete traceability from raw materials to finished products
- **Inspection Workflows**: Customizable quality control processes
- **Approval System**: Multi-level approval workflows with digital signatures

## 🧪 Testing

### Automated Testing

Run the comprehensive test suite:

```bash
# Install test dependencies (optional)
npm install --save-dev supertest

# Run all tests
node test-endpoints.js

# Run validation tests only
node test-endpoints.js --validation-only
```

### Test Coverage

The test suite covers:
- ✅ API endpoint functionality
- ✅ Input validation and sanitization
- ✅ Database operations (mocked)
- ✅ Error handling
- ✅ Security middleware

### Manual Testing

1. **Health Checks**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/health/db
   ```

2. **API Endpoints**
   ```bash
   # Test analytics endpoint
   curl http://localhost:3000/api/analytics/dashboard
   
   # Test search functionality
   curl "http://localhost:3000/api/search?q=test"
   ```

## 📈 Monitoring & Logging

### Logging System

The application includes comprehensive logging:

- **Structured Logs**: JSON format with metadata
- **Log Levels**: ERROR, WARN, INFO, DEBUG, TRACE
- **Multiple Outputs**: Console and file logging
- **Log Rotation**: Automatic cleanup and archiving
- **Performance Tracking**: Query timing and slow query detection

### Health Monitoring

Monitor application health through:

```http
GET /api/health              # Application health
GET /api/health/db           # Database health
GET /api/system/performance  # Detailed performance metrics
```

### Performance Metrics

Track key performance indicators:
- Database connection pool status
- Query execution times
- API response times
- Memory and CPU usage
- Error rates and patterns

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```env
   NODE_ENV=production
   LOG_LEVEL=WARN
   ENABLE_COMPRESSION=true
   TRUST_PROXY=true
   ```

2. **Database Optimization**
   - Configure connection pooling for production load
   - Set up read replicas for analytics queries
   - Enable query performance monitoring

3. **Security Hardening**
   - Use SSL/TLS for database connections
   - Configure firewall rules
   - Set up monitoring and alerting
   - Enable audit logging

4. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name biscuit-qc
   pm2 startup
   pm2 save
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 📝 Changelog

### v2.0.0 - Major Enhancement (Current)

#### 🎉 New Features
- Advanced analytics and reporting system
- Data export functionality with multiple formats
- Full-text search across all entities
- Notification and alert management
- Database migration system with rollback support
- Comprehensive logging and monitoring

#### 🏗️ Database Improvements
- Enhanced schema with analytics tables
- Performance metrics tracking
- Automatic data aggregation
- Improved indexing strategy
- Audit trail enhancements

#### 🔒 Security Enhancements
- Input validation and sanitization middleware
- Rate limiting protection
- Security headers implementation
- SQL injection prevention
- XSS protection

#### ⚡ Performance Optimizations
- Database connection pooling improvements
- Query optimization and caching
- Background task processing
- Memory usage optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions:
- Check the [Issues](../../issues) page
- Review the API documentation
- Check application logs for error details
- Use health check endpoints for diagnostics

## 🔗 Related Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Database Design Patterns](https://www.postgresql.org/docs/current/ddl.html)