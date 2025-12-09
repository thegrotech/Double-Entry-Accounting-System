// backend/database/db.js - Updated with environment variables
const { Pool } = require('pg');
require('dotenv').config();

// Check for either DATABASE_URL or individual variables
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  // Check for individual variables as fallback
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing database configuration. Please set either:');
    console.error('   1. DATABASE_URL (for Supabase)');
    console.error('   2. Or all individual variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    console.error('💡 For Supabase, use DATABASE_URL from project settings → Database → Connection string');
    process.exit(1);
  }
}

// PostgreSQL Connection Pool Configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'accounting_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  
  // Connection pool settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  
  // SSL configuration
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : process.env.DB_SSL === 'true' 
      ? { rejectUnauthorized: false } 
      : false,
});

// Log connection info (without password)
console.log(`📊 PostgreSQL Connection Info:
  Host: ${pool.options.host}
  Port: ${pool.options.port}
  Database: ${pool.options.database}
  User: ${pool.options.user}
  Pool Size: ${pool.options.max}
  SSL: ${pool.options.ssl ? 'Enabled' : 'Disabled'}
  Environment: ${process.env.NODE_ENV || 'development'}`);

// Event listeners
pool.on('connect', (client) => {
  // Set timezone to Karachi for this connection
  client.query(`SET TIME ZONE '${process.env.APP_TIMEZONE || 'Asia/Karachi'}'`)
    .catch(err => console.warn('⚠️ Could not set timezone:', err.message));
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
});

// Enhanced query function with logging
async function query(text, params, client = null) {
  const start = Date.now();
  const queryClient = client || pool;
  
  try {
    const result = await queryClient.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries
    if (duration > 1000) {
      console.warn(`🐌 Slow query (${duration}ms):`, {
        query: text.substring(0, 200),
        params: params || [],
        duration: `${duration}ms`
      });
    }
    
    // Log queries in development
    if (process.env.NODE_ENV === 'development' && process.env.LOG_QUERIES === 'true') {
      console.log(`📝 Query (${duration}ms):`, {
        query: text.substring(0, 200),
        rowCount: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Database query error:', {
      error: error.message,
      code: error.code,
      query: text.substring(0, 200),
      params: params || [],
      duration: `${duration}ms`
    });
    
    // Enhance error with more context
    const enhancedError = new Error(`Database error: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.query = text;
    enhancedError.params = params;
    
    throw enhancedError;
  }
}

// Health check with more details
async function checkHealth() {
  try {
    const result = await query(`
      SELECT 
        NOW() AT TIME ZONE $1 as server_time,
        current_setting('TimeZone') as timezone,
        version() as version,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections
    `, [process.env.APP_TIMEZONE || 'Asia/Karachi']);
    
    return {
      status: 'healthy',
      database: 'connected',
      timezone: result.rows[0].timezone,
      server_time: result.rows[0].server_time,
      version: result.rows[0].version.split(' ').slice(0, 2).join(' '),
      active_connections: parseInt(result.rows[0].active_connections),
      pool_total: pool.totalCount,
      pool_idle: pool.idleCount,
      pool_waiting: pool.waitingCount
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      pool_total: pool.totalCount,
      pool_idle: pool.idleCount
    };
  }
}

// Export for use in models
module.exports = {
  query,
  pool,
  checkHealth,
  
  // Helper method for transactions
  async transaction(callback) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback({
        query: (text, params) => query(text, params, client),
        client
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  
  // Helper to close pool (for tests)
  async close() {
    await pool.end();
  }

};
