/**
 * Database Migration System
 * Handles database schema updates and data migrations
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

class MigrationSystem {
  constructor() {
    this.migrationsDir = __dirname;
    this.migrationsTable = 'schema_migrations';
  }

  /**
   * Initialize the migration system by creating the migrations table
   */
  async initialize() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          execution_time INTEGER, -- milliseconds
          checksum VARCHAR(64),
          success BOOLEAN DEFAULT TRUE
        )
      `);
      
      console.log('Migration system initialized');
    } catch (error) {
      console.error('Failed to initialize migration system:', error);
      throw error;
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    try {
      const result = await db.query(`
        SELECT version, name, applied_at, success 
        FROM ${this.migrationsTable} 
        ORDER BY version ASC
      `);
      return result.rows;
    } catch (error) {
      console.error('Failed to get applied migrations:', error);
      return [];
    }
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      
      const migrationFiles = await this.getMigrationFiles();
      const pendingMigrations = migrationFiles.filter(file => 
        !appliedVersions.has(file.version)
      );
      
      return pendingMigrations;
    } catch (error) {
      console.error('Failed to get pending migrations:', error);
      return [];
    }
  }

  /**
   * Get all migration files from the migrations directory
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.match(/^\d{14}_.*\.sql$/))
        .map(file => {
          const version = file.substring(0, 14);
          const name = file.substring(15, file.length - 4);
          return {
            version,
            name,
            filename: file,
            filepath: path.join(this.migrationsDir, file)
          };
        })
        .sort((a, b) => a.version.localeCompare(b.version));
      
      return migrationFiles;
    } catch (error) {
      console.error('Failed to read migration files:', error);
      return [];
    }
  }

  /**
   * Calculate checksum for migration file content
   */
  async calculateChecksum(filepath) {
    const crypto = require('crypto');
    const content = await fs.readFile(filepath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration) {
    const startTime = Date.now();
    
    try {
      console.log(`Executing migration: ${migration.version}_${migration.name}`);
      
      // Read migration file
      const content = await fs.readFile(migration.filepath, 'utf8');
      const checksum = await this.calculateChecksum(migration.filepath);
      
      // Execute migration in a transaction
      await db.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(content);
        
        // Record the migration
        const executionTime = Date.now() - startTime;
        await client.query(`
          INSERT INTO ${this.migrationsTable} 
          (version, name, execution_time, checksum, success)
          VALUES ($1, $2, $3, $4, $5)
        `, [migration.version, migration.name, executionTime, checksum, true]);
      });
      
      console.log(`✅ Migration completed: ${migration.version}_${migration.name} (${Date.now() - startTime}ms)`);
      return { success: true, executionTime: Date.now() - startTime };
      
    } catch (error) {
      console.error(`❌ Migration failed: ${migration.version}_${migration.name}`, error);
      
      // Record failed migration
      try {
        const executionTime = Date.now() - startTime;
        const checksum = await this.calculateChecksum(migration.filepath);
        await db.query(`
          INSERT INTO ${this.migrationsTable} 
          (version, name, execution_time, checksum, success)
          VALUES ($1, $2, $3, $4, $5)
        `, [migration.version, migration.name, executionTime, checksum, false]);
      } catch (recordError) {
        console.error('Failed to record migration failure:', recordError);
      }
      
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    try {
      await this.initialize();
      
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return { migrationsRun: 0, success: true };
      }
      
      console.log(`Found ${pendingMigrations.length} pending migrations`);
      
      let successCount = 0;
      for (const migration of pendingMigrations) {
        try {
          await this.executeMigration(migration);
          successCount++;
        } catch (error) {
          console.error(`Migration ${migration.version} failed, stopping migration process`);
          return { 
            migrationsRun: successCount, 
            success: false, 
            error: error.message,
            failedMigration: migration.version
          };
        }
      }
      
      console.log(`✅ All ${successCount} migrations completed successfully`);
      return { migrationsRun: successCount, success: true };
      
    } catch (error) {
      console.error('Migration process failed:', error);
      return { migrationsRun: 0, success: false, error: error.message };
    }
  }

  /**
   * Rollback last migration (if rollback script exists)
   */
  async rollback() {
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const lastMigration = appliedMigrations[appliedMigrations.length - 1];
      
      if (!lastMigration) {
        console.log('No migrations to rollback');
        return { success: true, message: 'No migrations to rollback' };
      }
      
      // Look for rollback file
      const rollbackFile = path.join(
        this.migrationsDir, 
        `${lastMigration.version}_${lastMigration.name}_rollback.sql`
      );
      
      try {
        const rollbackContent = await fs.readFile(rollbackFile, 'utf8');
        
        // Execute rollback in transaction
        await db.transaction(async (client) => {
          await client.query(rollbackContent);
          await client.query(`
            DELETE FROM ${this.migrationsTable} 
            WHERE version = $1
          `, [lastMigration.version]);
        });
        
        console.log(`✅ Rollback completed: ${lastMigration.version}_${lastMigration.name}`);
        return { success: true, rolledBack: lastMigration.version };
        
      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          throw new Error(`Rollback file not found for migration ${lastMigration.version}`);
        }
        throw fileError;
      }
      
    } catch (error) {
      console.error('Rollback failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      const pendingMigrations = await this.getPendingMigrations();
      
      return {
        applied: appliedMigrations.length,
        pending: pendingMigrations.length,
        appliedMigrations: appliedMigrations.map(m => ({
          version: m.version,
          name: m.name,
          appliedAt: m.applied_at,
          success: m.success
        })),
        pendingMigrations: pendingMigrations.map(m => ({
          version: m.version,
          name: m.name,
          filename: m.filename
        }))
      };
    } catch (error) {
      console.error('Failed to get migration status:', error);
      return { error: error.message };
    }
  }

  /**
   * Create a new migration file template
   */
  async createMigration(name) {
    try {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
      const filename = `${timestamp}_${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.sql`;
      const filepath = path.join(this.migrationsDir, filename);
      
      const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- 
-- Description: ${name}
--
-- This migration should be idempotent - it should be safe to run multiple times

-- Add your migration SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE INDEX IF NOT EXISTS idx_example_table_name ON example_table(name);

-- Don't forget to create a corresponding rollback file if needed:
-- ${timestamp}_${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_rollback.sql
`;

      await fs.writeFile(filepath, template, 'utf8');
      console.log(`Migration file created: ${filename}`);
      
      return { success: true, filename, filepath };
    } catch (error) {
      console.error('Failed to create migration file:', error);
      return { success: false, error: error.message };
    }
  }
}

// Command line interface for migration system
async function runCLI() {
  const migrationSystem = new MigrationSystem();
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      const migrateResult = await migrationSystem.migrate();
      console.log('Migration result:', migrateResult);
      process.exit(migrateResult.success ? 0 : 1);
      
    case 'rollback':
      const rollbackResult = await migrationSystem.rollback();
      console.log('Rollback result:', rollbackResult);
      process.exit(rollbackResult.success ? 0 : 1);
      
    case 'status':
      const status = await migrationSystem.getStatus();
      console.log('Migration status:', JSON.stringify(status, null, 2));
      process.exit(0);
      
    case 'create':
      const migrationName = process.argv[3];
      if (!migrationName) {
        console.error('Usage: node migration-system.js create <migration_name>');
        process.exit(1);
      }
      const createResult = await migrationSystem.createMigration(migrationName);
      console.log('Create result:', createResult);
      process.exit(createResult.success ? 0 : 1);
      
    default:
      console.log(`
Usage: node migration-system.js <command>

Commands:
  migrate           Run all pending migrations
  rollback          Rollback the last migration (if rollback file exists)
  status            Show migration status
  create <name>     Create a new migration file

Examples:
  node migration-system.js migrate
  node migration-system.js status
  node migration-system.js create add_user_preferences_table
  node migration-system.js rollback
      `);
      process.exit(1);
  }
}

// Export the class and run CLI if this file is executed directly
module.exports = MigrationSystem;

if (require.main === module) {
  runCLI().catch(error => {
    console.error('CLI execution failed:', error);
    process.exit(1);
  });
}