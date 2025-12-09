const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load environment variables

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ===== LOAD COMPANY DETAILS =====
let companyDetails = {};
try {
    const companyDetailsPath = path.join(__dirname, 'company_details.json');
    if (fs.existsSync(companyDetailsPath)) {
        companyDetails = JSON.parse(fs.readFileSync(companyDetailsPath, 'utf8'));
        console.log('✅ Company details loaded:', companyDetails.company_name || 'Default Company');
    } else {
        // Create default company details file
        companyDetails = {
            company_name: "Business Accounting System",
            company_address: "123 Business Street, City, Pakistan",
            company_phone: "+92 300 1234567",
            company_email: "info@business.com",
            company_logo: "",
            tax_id: "123456789",
            currency_symbol: "₨",
            currency_code: "PKR",
            date_format: "dd/mm/yyyy",
            timezone: "Pakistan Standard Time (UTC+5)",
            fiscal_year_start: "01/07/2024",
            fiscal_year_end: "30/06/2025"
        };
        
        fs.writeFileSync(companyDetailsPath, JSON.stringify(companyDetails, null, 2));
        console.log('📁 Created default company_details.json file');
    }
} catch (error) {
    console.error('❌ Error loading company details:', error);
    companyDetails = {
        company_name: "Default Company",
        company_address: "Address not configured",
        currency_symbol: "₨",
        currency_code: "PKR"
    };
}

// ===== MIDDLEWARE =====

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API (or configure properly)
  crossOriginEmbedderPolicy: false,
}));

// Configure CORS for development and production
const allowedOrigins = [
  'https://double-entry-accounting-system.vercel.app',
  'https://double-entry-accounting-system-backend.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting (prevent brute force attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Only 10 login attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.'
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (enhanced)
app.use((req, res, next) => {
    const timestamp = new Date().toLocaleString('en-PK', { 
        timeZone: process.env.APP_TIMEZONE || 'Asia/Karachi' 
    });
    console.log(`📥 ${timestamp} | ${req.method} ${req.path} | IP: ${req.ip}`);
    next();
});

// ===== DATABASE HEALTH CHECK =====
// Import PostgreSQL database connection
const { checkHealth } = require('./database/db');

// Health check endpoint (for monitoring)
app.get('/api/health', async (req, res) => {
    try {
        const dbHealth = await checkHealth();
        const healthStatus = {
            status: 'online',
            timestamp: new Date().toISOString(),
            timezone: process.env.APP_TIMEZONE || 'Asia/Karachi',
            server_time: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
            database: dbHealth.status,
            database_timezone: dbHealth.timezone,
            database_connections: dbHealth.active_connections,
            version: '2.0.0', // Updated for PostgreSQL
            database_type: 'PostgreSQL',
            company: companyDetails.company_name
        };
        
        if (dbHealth.status === 'healthy') {
            res.json(healthStatus);
        } else {
            res.status(503).json({
                ...healthStatus,
                warning: 'Database connectivity issue detected',
                database_error: dbHealth.error
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== DATABASE INITIALIZATION ROUTE (Optional) =====
// One-time database setup endpoint (protected by secret key)
app.get('/api/init-database', authLimiter, async (req, res) => {
    // Check for secret key (only in development or with proper auth)
    if (process.env.NODE_ENV === 'production' && req.query.secret !== process.env.INIT_SECRET) {
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized - Secret key required in production' 
        });
    }
    
    try {
        console.log('🚀 Initializing PostgreSQL database...');
        
        // Dynamically import and run the PostgreSQL init script
        const { initializeDatabase } = require('./database/init-pg');
        await initializeDatabase();
        
        res.json({ 
            success: true, 
            message: 'PostgreSQL database initialized successfully',
            database: 'PostgreSQL',
            timezone: process.env.APP_TIMEZONE || 'Asia/Karachi'
        });
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            note: 'Make sure PostgreSQL is running and connection details are correct'
        });
    }
});

// ===== IMPORT ROUTES =====
const authRoutes = require('./routes/authRoutes');
const accountingRoutes = require('./routes/accountingRoutes');

// ===== MOUNT ROUTES =====
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', accountingRoutes); // Includes company-details endpoint

// ===== ROOT ENDPOINT (Enhanced) =====
app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: 'Accounting System API',
        status: 'online',
        version: '2.0.0', // Updated version for PostgreSQL
        database: 'PostgreSQL',
        timezone: process.env.APP_TIMEZONE || 'Asia/Karachi',
        company: companyDetails.company_name,
        features: {
            authentication: 'JWT-based authentication with roles',
            database: 'PostgreSQL with connection pooling',
            timezone: 'Karachi, Pakistan (UTC+5)',
            roles: ['admin (full access)', 'viewer (read-only)'],
            security: 'Role-based access control (RBAC)',
            performance: 'Connection pooling for high concurrency'
        },
        endpoints: {
            authentication: {
                login: 'POST /api/auth/login',
                verify: 'GET /api/auth/verify',
                profile: 'GET /api/auth/profile',
                changePassword: 'PUT /api/auth/change-password'
            },
            accounts: {
                getAll: 'GET /api/accounts (authenticated)',
                create: 'POST /api/accounts (admin only)',
                getById: 'GET /api/accounts/:id (authenticated)',
                update: 'PUT /api/accounts/:id (admin only)',
                delete: 'DELETE /api/accounts/:id (admin only)'
            },
            transactions: {
                getAll: 'GET /api/transactions (authenticated)',
                create: 'POST /api/transactions (admin only)',
                getById: 'GET /api/transactions/:id (authenticated)',
                update: 'PUT /api/transactions/:id (admin only)',
                delete: 'DELETE /api/transactions/:id (admin only)',
                byDate: 'GET /api/transactions/by-date-range?startDate=&endDate= (authenticated)'
            },
            reports: {
                balanceSheet: 'GET /api/reports/balance-sheet (authenticated)',
                incomeStatement: 'GET /api/reports/income-statement (authenticated)',
                ledger: 'GET /api/reports/ledger/:accountId?startDate=&endDate= (authenticated)',
                financialRatios: 'GET /api/reports/financial-ratios (authenticated)'
            },
            system: {
                validate: 'GET /api/system/validate-equation (admin only)',
                stats: 'GET /api/system/stats (admin only)',
                companyDetails: 'GET /api/company-details (authenticated)',
                databaseHealth: 'GET /api/health (public)',
                initDatabase: 'GET /api/init-database?secret=YOUR_SECRET (development)'
            }
        },
        environment: process.env.NODE_ENV || 'development',
        support: companyDetails.company_email || 'support@accounting.com',
        note: 'All API endpoints (except login and health) require JWT token in Authorization header'
    });
});

// ===== 404 HANDLER =====
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        server_time: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
        availableEndpoints: {
            public: ['POST /api/auth/login', 'GET /', 'GET /api/health'],
            authenticated: ['/api/accounts', '/api/transactions', '/api/reports', '/api/company-details'],
            adminOnly: ['/api/auth/users', '/api/system/*']
        },
        help: 'Check the root endpoint (GET /) for complete API documentation'
    });
});

// ===== ERROR HANDLING (Enhanced for PostgreSQL) =====
app.use((err, req, res, next) => {
    const timestamp = new Date().toLocaleString('en-PK', { 
        timeZone: process.env.APP_TIMEZONE || 'Asia/Karachi' 
    });
    
    // PostgreSQL-specific error handling
    let userMessage = 'Internal server error';
    let statusCode = err.status || 500;
    
    if (err.code) {
        // PostgreSQL error codes (see: https://www.postgresql.org/docs/current/errcodes-appendix.html)
        switch (err.code) {
            case '23505': // unique_violation
                userMessage = 'Duplicate record found';
                statusCode = 409;
                break;
            case '23503': // foreign_key_violation
                userMessage = 'Referenced record does not exist';
                statusCode = 400;
                break;
            case '23502': // not_null_violation
                userMessage = 'Required field is missing';
                statusCode = 400;
                break;
            case '23514': // check_violation
                userMessage = 'Data validation failed';
                statusCode = 400;
                break;
            case '28P01': // invalid_password
                userMessage = 'Database authentication failed';
                statusCode = 500;
                break;
            case '08006': // connection_failure
                userMessage = 'Database connection failed';
                statusCode = 503;
                break;
        }
    }
    
    // Log the error (with PostgreSQL context if available)
    console.error('🚨 Server Error:', {
        timestamp,
        message: err.message,
        postgresql_code: err.code,
        postgresql_detail: err.detail,
        user_message: userMessage,
        path: req.path,
        method: req.method,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    // Handle authentication errors
    if (err.name === 'UnauthorizedError' || err.status === 401) {
        return res.status(401).json({ 
            success: false,
            error: 'Authentication required',
            message: 'Invalid or expired token. Please login again.'
        });
    }
    
    // Handle authorization errors
    if (err.status === 403) {
        return res.status(403).json({ 
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to access this resource.'
        });
    }
    
    // Send response to client
    res.status(statusCode).json({ 
        success: false,
        error: userMessage,
        message: process.env.NODE_ENV === 'development' ? err.message : userMessage,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
            code: err.code,
            detail: err.detail
        })
    });
});

// ===== START SERVER =====
const server = app.listen(PORT, async () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ACCOUNTING SYSTEM SERVER STARTED');
    console.log('='.repeat(70));
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📊 Database: PostgreSQL (Connection Pooling Enabled)`);
    console.log(`🔐 Authentication: JWT with role-based access control`);
    console.log(`⏰ Timezone: ${process.env.APP_TIMEZONE || 'Asia/Karachi'}`);
    console.log(`🏢 Company: ${companyDetails.company_name}`);
    console.log(`💰 Currency: ${companyDetails.currency_symbol} ${companyDetails.currency_code}`);
    console.log(`🛡️  Security: Helmet headers, Rate limiting, CORS`);
    console.log('='.repeat(70));
    
    // Test database connection on startup
    try {
        const health = await checkHealth();
        console.log(`📊 Database Status: ${health.status.toUpperCase()}`);
        console.log(`   Timezone: ${health.timezone}`);
        console.log(`   Version: ${health.version}`);
        console.log(`   Active Connections: ${health.active_connections}`);
        
        if (health.status === 'healthy') {
            console.log('✅ PostgreSQL connection established successfully');
        } else {
            console.warn('⚠️  Database connection issue detected');
            console.warn('   Error:', health.error);
        }
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        console.log('💡 Make sure:');
        console.log('   1. PostgreSQL is running');
        console.log('   2. Database connection details in .env are correct');
        console.log('   3. Database "accounting_system" exists');
    }
    
    console.log('\n📋 Available Endpoints:');
    console.log(`   🔑 Login: POST http://localhost:${PORT}/api/auth/login`);
    console.log(`   📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`   📁 API Documentation: http://localhost:${PORT}/`);
    console.log(`   🏢 Company Details: http://localhost:${PORT}/api/company-details`);
    console.log(`   🗄️  Init Database: http://localhost:${PORT}/api/init-database?secret=YOUR_SECRET`);
    
    console.log('\n🔒 Security Notes:');
    console.log('   1. Change default passwords in .env file immediately!');
    console.log('   2. Set strong JWT_SECRET in .env file');
    console.log('   3. Update FRONTEND_URL in .env for CORS');
    console.log('   4. Set INIT_SECRET for database initialization');
    console.log('   5. Regular database backups recommended');
    
    console.log('\n⚡ Ready to process accounting transactions with PostgreSQL!');
    console.log('='.repeat(70));
});

// ===== GRACEFUL SHUTDOWN (Enhanced) =====
const shutdown = async () => {
    console.log('\n🛑 Received shutdown signal...');
    console.log('⏳ Closing connections gracefully...');
    
    // Close HTTP server
    server.close(async () => {
        console.log('✅ HTTP server closed');
        
        // Close PostgreSQL connection pool
        try {
            const { pool } = require('./database/db');
            await pool.end();
            console.log('✅ PostgreSQL connection pool closed');
        } catch (error) {
            console.error('⚠️ Error closing database pool:', error.message);
        }
        
        console.log('👋 Server shutdown complete');
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('⚠️ Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    
    // Don't exit for PostgreSQL connection errors
    if (error.code && (error.code.startsWith('28') || error.code.startsWith('08'))) {
        console.error('⚠️ PostgreSQL connection error - check database connection');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});


module.exports = app;


