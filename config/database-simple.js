/**
 * Simple Database Configuration with In-Memory Fallback
 * This provides a working database solution when PostgreSQL is not available
 */

require('dotenv').config();
const { logger } = require('../utils/logger');

// In-memory data store for development/testing
const inMemoryStore = {
  products: new Map(),
  reports: new Map(),
  signatures: new Map(),
  settings: new Map(),
  notifications: new Map(),
  sessions: new Map(),
  nextId: 1
};

// Generate UUID-like IDs
function generateId() {
  const id = `mem-${Date.now()}-${inMemoryStore.nextId++}`;
  return id;
}

// Simple Database class that works without external dependencies
class SimpleDatabase {
  constructor() {
    this.connected = false;
    this.usePostgreSQL = false;
    this.pool = null;
  }

  // Initialize database connection
  async initialize() {
    try {
      // Try PostgreSQL first if configured
      if (process.env.DB_HOST && process.env.DB_NAME && !process.env.USE_MEMORY_DB) {
        try {
          const { Pool } = require('pg');
          
          const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'biscuit_qc_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 5000,
            max: 5,
            min: 1
          };

          this.pool = new Pool(dbConfig);
          
          // Test connection
          const client = await this.pool.connect();
          client.release();
          
          this.usePostgreSQL = true;
          this.connected = true;
          logger.info('PostgreSQL database connected successfully');
          
          return true;
        } catch (pgError) {
          logger.warn('PostgreSQL connection failed, falling back to in-memory storage', { error: pgError.message });
        }
      }
      
      // Fallback to in-memory storage
      this.usePostgreSQL = false;
      this.connected = true;
      
      // Initialize with sample data
      await this.initializeSampleData();
      
      logger.info('Using in-memory database (data will not persist between restarts)');
      logger.warn('To use persistent storage, configure PostgreSQL in .env file');
      
      return true;
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw error;
    }
  }

  // Initialize sample data for development
  async initializeSampleData() {
    // Add sample product if none exist
    if (inMemoryStore.products.size === 0) {
      const sampleProduct = {
        id: generateId(),
        product_id: 'plain-biscuit',
        name: 'Plain Biscuits',
        code: 'PB001',
        batch_code: 'PB',
        ingredients_type: 'without-cocoa',
        has_cream: false,
        standard_weight: 185.0,
        shelf_life: 6,
        cartons_per_pallet: 56,
        packs_per_box: 6,
        boxes_per_carton: 14,
        empty_box_weight: 21.0,
        empty_carton_weight: 680.0,
        aql_level: '1.5',
        day_format: 'DD',
        month_format: 'letter',
        description: 'Standard plain biscuit without cocoa',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      inMemoryStore.products.set(sampleProduct.id, sampleProduct);
      logger.info('Sample product added to in-memory database');
    }

    // Add sample signatures
    if (inMemoryStore.signatures.size === 0) {
      const signatures = [
        { id: generateId(), name: 'Quality Inspector', role: 'QC Inspector', department: 'Quality Control', is_default: true, is_active: true },
        { id: generateId(), name: 'Shift Supervisor', role: 'Supervisor', department: 'Production', is_default: true, is_active: true },
        { id: generateId(), name: 'Quality Manager', role: 'Manager', department: 'Quality Assurance', is_default: false, is_active: true }
      ];
      
      signatures.forEach(sig => {
        sig.created_at = new Date().toISOString();
        sig.updated_at = new Date().toISOString();
        inMemoryStore.signatures.set(sig.id, sig);
      });
      
      logger.info('Sample signatures added to in-memory database');
    }
  }

  // Execute a query (PostgreSQL or in-memory)
  async query(text, params = []) {
    if (this.usePostgreSQL && this.pool) {
      // Use PostgreSQL
      const client = await this.pool.connect();
      try {
        const start = Date.now();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.DEBUG_SQL === 'true') {
          logger.debug('SQL Query executed', {
            query: text.substring(0, 100),
            duration: `${duration}ms`,
            rows: result.rowCount
          });
        }
        
        return result;
      } finally {
        client.release();
      }
    } else {
      // Use in-memory storage - simulate PostgreSQL responses
      return this.simulateQuery(text, params);
    }
  }

  // Simulate PostgreSQL queries for in-memory storage
  simulateQuery(text, params = []) {
    const query = text.toLowerCase().trim();
    
    // Handle SELECT queries
    if (query.startsWith('select')) {
      if (query.includes('from products')) {
        const products = Array.from(inMemoryStore.products.values());
        return { rows: products, rowCount: products.length };
      }
      
      if (query.includes('from reports')) {
        const reports = Array.from(inMemoryStore.reports.values());
        return { rows: reports, rowCount: reports.length };
      }
      
      if (query.includes('from signatures')) {
        const signatures = Array.from(inMemoryStore.signatures.values());
        return { rows: signatures, rowCount: signatures.length };
      }
      
      if (query.includes('from settings')) {
        const settings = Array.from(inMemoryStore.settings.values());
        return { rows: settings, rowCount: settings.length };
      }
      
      // Default response for other SELECT queries
      return { rows: [], rowCount: 0 };
    }
    
    // Handle INSERT queries
    if (query.startsWith('insert')) {
      const id = generateId();
      return { rows: [{ id }], rowCount: 1 };
    }
    
    // Handle UPDATE queries
    if (query.startsWith('update')) {
      return { rows: [{}], rowCount: 1 };
    }
    
    // Handle DELETE queries
    if (query.startsWith('delete')) {
      return { rows: [], rowCount: 1 };
    }
    
    // Default response
    return { rows: [], rowCount: 0 };
  }

  // Helper methods for common operations
  async findWhere(table, conditions = {}, orderBy = 'created_at DESC', limit = null, offset = null) {
    if (this.usePostgreSQL) {
      // Use the original PostgreSQL implementation
      let query = `SELECT * FROM ${table}`;
      const values = [];
      
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.entries(conditions)
          .map(([key], index) => `${key} = $${index + 1}`)
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        values.push(...Object.values(conditions));
      }
      
      if (orderBy) query += ` ORDER BY ${orderBy}`;
      if (limit) query += ` LIMIT ${limit}`;
      if (offset) query += ` OFFSET ${offset}`;
      
      const result = await this.query(query, values);
      return result.rows;
    } else {
      // Use in-memory storage
      const store = inMemoryStore[table];
      if (!store) return [];
      
      let items = Array.from(store.values());
      
      // Apply conditions
      if (Object.keys(conditions).length > 0) {
        items = items.filter(item => {
          return Object.entries(conditions).every(([key, value]) => item[key] === value);
        });
      }
      
      // Apply ordering (simple implementation)
      if (orderBy && orderBy.includes('created_at DESC')) {
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      // Apply limit and offset
      if (offset) items = items.slice(offset);
      if (limit) items = items.slice(0, limit);
      
      return items;
    }
  }

  async insert(table, data) {
    if (this.usePostgreSQL) {
      // Use PostgreSQL
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
    } else {
      // Use in-memory storage
      const id = generateId();
      const item = {
        ...data,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (!inMemoryStore[table]) {
        inMemoryStore[table] = new Map();
      }
      
      inMemoryStore[table].set(id, item);
      
      logger.debug(`Item inserted into ${table}`, { id, table });
      return id;
    }
  }

  async findById(table, id) {
    if (this.usePostgreSQL) {
      const result = await this.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return result.rows[0];
    } else {
      const store = inMemoryStore[table];
      return store ? store.get(id) : null;
    }
  }

  async updateById(table, id, data) {
    if (this.usePostgreSQL) {
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
    } else {
      const store = inMemoryStore[table];
      if (!store || !store.has(id)) return null;
      
      const item = store.get(id);
      const updated = {
        ...item,
        ...data,
        updated_at: new Date().toISOString()
      };
      
      store.set(id, updated);
      logger.debug(`Item updated in ${table}`, { id, table });
      return updated;
    }
  }

  async count(table, conditions = {}) {
    const items = await this.findWhere(table, conditions);
    return items.length;
  }

  async healthCheck() {
    return {
      status: this.connected ? 'healthy' : 'unhealthy',
      connected: this.connected,
      type: this.usePostgreSQL ? 'postgresql' : 'in-memory',
      timestamp: new Date().toISOString()
    };
  }

  async setUserContext(userId) {
    // No-op for in-memory storage
    return true;
  }

  async close() {
    if (this.pool && this.usePostgreSQL) {
      await this.pool.end();
    }
    this.connected = false;
    logger.info('Database connections closed');
  }

  // Add methods for enhanced functionality
  async getReportAnalytics(filters = {}) {
    const reports = await this.findWhere('reports', {});
    return {
      success: true,
      data: reports,
      summary: {
        totalReports: reports.length,
        approvedReports: reports.filter(r => r.status === 'approved').length,
        averageScore: reports.reduce((sum, r) => sum + (r.score || 0), 0) / reports.length || 0
      }
    };
  }

  async exportData(table, filters = {}, format = 'json') {
    const data = await this.findWhere(table, filters);
    return {
      success: true,
      data,
      format,
      recordCount: data.length,
      exportedAt: new Date().toISOString()
    };
  }

  async advancedSearch(searchParams) {
    const { query } = searchParams;
    const results = [];
    
    // Search products
    const products = await this.findWhere('products', {});
    products.forEach(product => {
      if (product.name?.toLowerCase().includes(query.toLowerCase()) ||
          product.code?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          result_type: 'product',
          id: product.id,
          title: product.name,
          subtitle: product.code
        });
      }
    });
    
    return {
      success: true,
      results,
      query,
      resultCount: results.length
    };
  }

  async getPerformanceMetrics() {
    return {
      poolStats: { totalConnections: 1, idleConnections: 1 },
      databaseStats: { db_name: 'in-memory', db_size: 'N/A' },
      tableSizes: [],
      timestamp: new Date().toISOString()
    };
  }

  async performMaintenance() {
    return {
      success: true,
      message: 'In-memory database maintenance completed',
      timestamp: new Date().toISOString()
    };
  }
}

// Create and export database instance
const database = new SimpleDatabase();

module.exports = database;