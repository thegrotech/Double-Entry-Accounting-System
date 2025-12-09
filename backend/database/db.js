// backend/database/db.js - Production Ready for Supabase
const { Pool } = require('pg');
require('dotenv').config();

// ============================================
// DATABASE CONNECTION CONFIGURATION
// ============================================

let connectionConfig;

// Priority 1: Use DATABASE_URL (for Supabase)
if (process.env.DATABASE_URL) {
  console.log('📊 Using DATABASE_URL for PostgreSQL connection');
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    // SSL is REQUIRED for Supabase
    ssl: {
      rejectUnauthorized: false
    }
  };
} 
// Priority 2: Use individual variables (for local development)
else {
  console.log('📊 Using individual variables for PostgreSQL connection');
  connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'accounting_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    // SSL for production, optional for development
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : process.env.DB_SSL === 'true' 
        ? { rejectUnauthorized: false } 
        : false
  };
}

// ============================================
// CREATE CONNECTION POOL
// ============================================

const pool = new Pool({
  ...connectionConfig,
  // Connection pool settings (optimized for production)
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  min: parseInt(process.env.DB_MIN_CONNECTIONS) || 2,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  allowExitOnIdle: true
});

// ============================================
// LOGGING AND DIAGNOSTICS
// ============================================

// Safe logging (without exposing password)
console.log(`📊 PostgreSQL Connection Info:
  Using: ${process.env.DATABASE_URL ? 'DATABASE_URL (Supabase)' : 'Individual Variables'}
  Database: ${connectionConfig.database || 'From connection string'}
  Port: ${connectionConfig.port || 'From connection string'}
  Pool Size: ${pool.options.max}
  SSL: ${connectionConfig.ssl ? 'Enabled' : 'Disabled'}
  Environment: ${process.env.NODE_ENV || 'development'}
  Timezone: ${process.env.APP_TIMEZONE || 'Asia/Karachi'}`);

// ============================================
// EVENT HANDLERS
// ============================================

pool.on('connect', (client) => {
  // Set timezone for this connection
  const timezone = process.env.APP_TIMEZONE || 'Asia/Karachi';
  client.query(`SET TIME ZONE '${timezone}'`)
    .catch(err => console.warn(`⚠️ Could not set timezone to ${timezone}:`, err.message));
  
  // Set search path if needed
  client.query('SET search_path TO public')
    .catch(err => console.warn('⚠️ Could not set search path:', err.message));
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected PostgreSQL pool error:', {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

pool.on('remove', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔌 Client removed from pool');
  }
});

// ============================================
// QUERY FUNCTION WITH ENHANCED ERROR HANDLING
// ============================================

async function query(text, params, client = null) {
  const start = Date.now();
  const queryClient = client || pool;
  
  try {
    const result = await queryClient.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in production
    if (duration > 1000 && process.env.NODE_ENV === 'production') {
      console.warn(`🐌 Slow query detected (${duration}ms):`, {
        query: text.substring(0, 150),
        duration: `${duration}ms`,
        rowCount: result.rowCount
      });
    }
    
    // Detailed logging in development
    if (process.env.NODE_ENV === 'development' && process.env.LOG_QUERIES === 'true') {
      console.log(`📝 Query executed (${duration}ms):`, {
        query: text.substring(0, 200),
        params: params || [],
        rowCount: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Enhanced error logging
    console.error('❌ Database query error:', {
      error: error.message,
      code: error.code,
      query: text.substring(0, 150),
      params: params || [],
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Re-throw with enhanced context
    const enhancedError = new Error(`Database error: ${error.message}`);
    enhancedError.code = error.code;
    enhancedError.query = text;
    enhancedError.params = params;
    enhancedError.duration = duration;
    enhancedError.originalError = error;
    
    throw enhancedError;
  }
}

// ============================================
// HEALTH CHECK FUNCTION
// ============================================

async function checkHealth() {
  const start = Date.now();
  
  try {
    const result = await query(`
      SELECT 
        NOW() AT TIME ZONE $1 as server_time,
        current_setting('TimeZone') as timezone,
        version() as version,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
    `, [process.env.APP_TIMEZONE || 'Asia/Karachi']);
    
    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      database: 'connected',
      timezone: result.rows[0].timezone,
      server_time: result.rows[0].server_time,
      version: result.rows[0].version.split(' ').slice(0, 3).join(' '),
      active_connections: parseInt(result.rows[0].active_connections) || 0,
      max_connections: parseInt(result.rows[0].max_connections) || 100,
      connection_time: `${duration}ms`,
      pool_total: pool.totalCount || 0,
      pool_idle: pool.idleCount || 0,
      pool_waiting: pool.waitingCount || 0,
      environment: process.env.NODE_ENV || 'development'
    };
  } catch (error) {
    const duration = Date.now() - start;
    
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      error_code: error.code,
      connection_time: `${duration}ms`,
      pool_total: pool.totalCount || 0,
      pool_idle: pool.idleCount || 0,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================
// TRANSACTION HELPER
// ============================================

async function transaction(callback) {
  const client = await pool.connect();
  const start = Date.now();
  
  try {
    await client.query('BEGIN');
    
    // Create a transaction-aware query function
    const transactionQuery = (text, params) => query(text, params, client);
    
    const result = await callback({
      query: transactionQuery,
      client
    });
    
    await client.query('COMMIT');
    
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Transaction completed (${duration}ms)`);
    }
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    
    const duration = Date.now() - start;
    console.error(`❌ Transaction failed after ${duration}ms:`, {
      error: error.message,
      code: error.code
    });
    
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// CONNECTION TEST (for initialization)
// ============================================

async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    console.log('✅ PostgreSQL connection test successful:', {
      time: result.rows[0].current_time,
      version: result.rows[0].version.split('\n')[0]
    });
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', {
      error: error.message,
      code: error.code,
      suggestion: 'Check DATABASE_URL or individual connection variables'
    });
    return false;
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function closePool() {
  if (process.env.NODE_ENV === 'development') {
    console.log('🛑 Closing PostgreSQL connection pool...');
  }
  
  try {
    await pool.end();
    console.log('✅ PostgreSQL connection pool closed gracefully');
  } catch (error) {
    console.error('❌ Error closing connection pool:', error.message);
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  query,
  pool,
  checkHealth,
  transaction,
  testConnection,
  closePool
};
