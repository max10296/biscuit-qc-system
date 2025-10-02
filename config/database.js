const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'biscuit_qc_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  idle: parseInt(process.env.DB_POOL_IDLE) || 1000,
  acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
  
  // Connection timeout
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  
  // Query timeout
  query_timeout: 60000,
  statement_timeout: 60000,
  
  // Application name for connection tracking
  application_name: 'biscuit-qc-system'
};

// Create connection pool
const pool = new Pool(dbConfig);

// Global error handler
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Database connection class
class Database {
  constructor() {
    this.pool = pool;
    this.connected = false;
  }

  // Initialize database connection and create tables if needed
  async initialize() {
    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      
      // Check if tables exist and create them if needed
      await this.ensureTablesExist(client);
      
      client.release();
      this.connected = true;
      
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  // Check if main tables exist
  async ensureTablesExist(client) {
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('products', 'reports', 'settings', 'signatures')
      `);
      
      const existingTables = result.rows.map(row => row.table_name);
      const requiredTables = ['products', 'reports', 'settings', 'signatures'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.log(`⚠️  Missing tables: ${missingTables.join(', ')}`);
        console.log('Please run the database_schema_optimized.sql script to create the required tables.');
        console.log('You can find the script in the project root directory.');
      } else {
        console.log('✅ All required tables exist');
      }
    } catch (error) {
      console.warn('Warning: Could not check table existence:', error.message);
    }
  }

  // Execute a query with connection from pool
  async query(text, params = []) {
    const client = await this.pool.connect();
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (over 1 second)
      if (duration > 1000) {
        console.log('Slow query:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', {
        error: error.message,
        query: text,
        params: params
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // Execute a transaction
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get a client for complex operations
  async getClient() {
    return await this.pool.connect();
  }

  // Close all connections
  async close() {
    try {
      await this.pool.end();
      console.log('✅ Database connections closed');
      this.connected = false;
    } catch (error) {
      console.error('❌ Error closing database connections:', error.message);
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as status');
      return {
        status: 'healthy',
        connected: this.connected,
        timestamp: new Date().toISOString(),
        pool: {
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingCount: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Database maintenance
  async performMaintenance() {
    try {
      const result = await this.query('SELECT perform_database_maintenance()');
      return {
        success: true,
        message: result.rows[0]?.perform_database_maintenance || 'Maintenance completed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Database maintenance error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Set user context for audit logging
  async setUserContext(userId) {
    try {
      await this.query('SELECT set_config($1, $2, false)', ['app.current_user_id', userId || 'system']);
    } catch (error) {
      console.warn('Could not set user context:', error.message);
    }
  }

  // Helper methods for common operations
  
  // Insert with returning ID
  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')}) 
      VALUES (${placeholders.join(', ')}) 
      RETURNING id
    `;
    
    const result = await this.query(query, values);
    return result.rows[0].id;
  }

  // Update by ID
  async updateById(table, id, data) {
    const entries = Object.entries(data);
    const setClause = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...entries.map(([, value]) => value)];
    
    const query = `
      UPDATE ${table} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.query(query, values);
    return result.rows[0];
  }

  // Delete by ID
  async deleteById(table, id) {
    const result = await this.query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0];
  }

  // Find by ID
  async findById(table, id) {
    const result = await this.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0];
  }

  // Find with conditions
  async findWhere(table, conditions = {}, orderBy = 'created_at DESC', limit = null, offset = null) {
    let query = `SELECT * FROM ${table}`;
    const values = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.entries(conditions)
        .map(([key], index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    if (offset) {
      query += ` OFFSET ${offset}`;
    }
    
    const result = await this.query(query, values);
    return result.rows;
  }

  // Count records
  async count(table, conditions = {}) {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const values = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.entries(conditions)
        .map(([key], index) => `${key} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }
    
    const result = await this.query(query, values);
    return parseInt(result.rows[0].count);
  }
}

// Create and export database instance
const database = new Database();

module.exports = database;