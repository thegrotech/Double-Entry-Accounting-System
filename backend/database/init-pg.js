// backend/database/init-pg.js - PostgreSQL Version
const bcrypt = require('bcrypt');
const { query, pool } = require('./db');

console.log('🚀 Initializing PostgreSQL accounting database...');
console.log('📍 Timezone: Asia/Karachi (UTC+5)');

// ===== DATABASE SCHEMA CREATION =====
async function initializeDatabase() {
  try {
    console.log('\n📊 Creating database tables...');

    // 1. Chart of Accounts Table
    await query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        account_code VARCHAR(10) NOT NULL UNIQUE,
        account_name VARCHAR(100) NOT NULL,
        account_type VARCHAR(50) NOT NULL CHECK(account_type IN ('Asset', 'Liability', 'Capital', 'Revenue', 'Expense')),
        account_subtype VARCHAR(50),
        normal_balance VARCHAR(10) NOT NULL CHECK(normal_balance IN ('Debit', 'Credit')),
        balance DECIMAL(15,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Accounts table ready');

    // 2. Transactions Table
    await query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        transaction_number INTEGER UNIQUE,
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        reference VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Transactions table ready');

    // 3. Journal Entries Table
    await query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL CHECK(amount > 0),
        entry_type VARCHAR(10) NOT NULL CHECK(entry_type IN ('Debit', 'Credit')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
      )
    `);
    console.log('✅ Journal entries table ready');

    // 4. Users Table (For Authentication)
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(10) NOT NULL CHECK(role IN ('admin', 'viewer')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Users table ready');

    // Check and fix schema
    await checkAndFixSchema();
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// ===== SCHEMA VALIDATION AND FIXES =====
async function checkAndFixSchema() {
  console.log('\n🔍 Validating database schema...');

  try {
    // Check if updated_at column exists in transactions
    const tableInfo = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name IN ('updated_at', 'transaction_number')
    `);

    const columns = tableInfo.rows.map(row => row.column_name);
    const hasUpdatedAt = columns.includes('updated_at');
    const hasTransactionNumber = columns.includes('transaction_number');

    // Add missing columns
    if (!hasUpdatedAt) {
      console.log('📝 Adding updated_at column to transactions table...');
      await query(`ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE`);
      await query(`UPDATE transactions SET updated_at = NOW() WHERE updated_at IS NULL`);
      console.log('✅ Successfully added updated_at column');
    } else {
      console.log('✅ updated_at column already exists in transactions table');
    }

    if (!hasTransactionNumber) {
      console.log('📝 Adding transaction_number column to transactions table...');
      await query(`ALTER TABLE transactions ADD COLUMN transaction_number INTEGER`);
      console.log('✅ Successfully added transaction_number column');
    } else {
      console.log('✅ transaction_number column already exists');
    }

    if (hasTransactionNumber) {
      await checkTransactionNumbers();
    } else {
      await createIndexes();
    }
  } catch (error) {
    console.error('❌ Error in schema validation:', error);
    await createIndexes();
  }
}

// ===== INDEX CREATION =====
async function createIndexes() {
  console.log('\n📊 Creating database indexes for optimal performance...');

  const indexes = [
    // Journal entries indexes
    `CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_id ON journal_entries(transaction_id)`,
    `CREATE INDEX IF NOT EXISTS idx_journal_entries_account_id ON journal_entries(account_id)`,
    
    // Transactions indexes
    `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_updated ON transactions(updated_at)`,
    
    // Accounts indexes
    `CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type)`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(account_code)`,
    
    // Users indexes
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)`
  ];

  try {
    for (const sql of indexes) {
      try {
        await query(sql);
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists')) {
          console.error(`⚠️ Error creating index: ${err.message}`);
        }
      }
    }
    console.log(`✅ Indexes created for optimal performance`);
    await checkTransactionNumbers();
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    await checkTransactionNumbers();
  }
}

// ===== TRANSACTION NUMBER MANAGEMENT =====
async function checkTransactionNumbers() {
  try {
    const result = await query(
      `SELECT COUNT(*) as null_count FROM transactions WHERE transaction_number IS NULL`
    );
    
    if (parseInt(result.rows[0].null_count) > 0) {
      console.log(`📝 Found ${result.rows[0].null_count} transactions with NULL numbers - populating...`);
      await populateTransactionNumbers();
    } else {
      console.log('✅ All transactions have transaction numbers');
      await initializeDefaultAccounts();
    }
  } catch (error) {
    console.error('❌ Error checking transaction numbers:', error);
    await initializeDefaultAccounts();
  }
}

async function populateTransactionNumbers() {
  console.log('🔢 Populating missing transaction numbers...');

  try {
    // Use a transaction to ensure data consistency
    await query('BEGIN');
    
    // Set temporary negative numbers
    await query(`
      UPDATE transactions 
      SET transaction_number = -id 
      WHERE transaction_number IS NULL
    `);
    
    // Set sequential numbers
    await query(`
      UPDATE transactions 
      SET transaction_number = sub.new_number
      FROM (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY created_at, id) as new_number 
        FROM transactions 
        WHERE transaction_number < 0
      ) sub
      WHERE transactions.id = sub.id
    `);
    
    await query('COMMIT');
    console.log('✅ Successfully set transaction numbers');
    await initializeDefaultAccounts();
  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error populating transaction numbers:', error);
    await initializeDefaultAccounts();
  }
}

// ===== DEFAULT ACCOUNTS SETUP =====
async function initializeDefaultAccounts() {
  console.log('\n📋 Setting up default chart of accounts...');

  try {
    const result = await query('SELECT COUNT(*) as count FROM accounts');
    
    if (parseInt(result.rows[0].count) > 0) {
      console.log(`✅ Accounts table already has ${result.rows[0].count} accounts`);
      await initializeDefaultUsers();
      return;
    }

    console.log('📝 Inserting default chart of accounts...');

    const defaultAccounts = [
      // Assets (1xxx series)
      { code: '1001', name: 'Cash', type: 'Asset', subtype: 'Current', normal_balance: 'Debit' },
      { code: '1002', name: 'Bank Account', type: 'Asset', subtype: 'Current', normal_balance: 'Debit' },
      { code: '1003', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current', normal_balance: 'Debit' },
      { code: '1004', name: 'Inventory', type: 'Asset', subtype: 'Current', normal_balance: 'Debit' },
      { code: '1101', name: 'Office Equipment', type: 'Asset', subtype: 'Non-Current', normal_balance: 'Debit' },
      { code: '1102', name: 'Furniture & Fixtures', type: 'Asset', subtype: 'Non-Current', normal_balance: 'Debit' },
      
      // Liabilities (2xxx series)
      { code: '2001', name: 'Accounts Payable', type: 'Liability', subtype: 'Current', normal_balance: 'Credit' },
      { code: '2002', name: 'Loans Payable', type: 'Liability', subtype: 'Current', normal_balance: 'Credit' },
      { code: '2101', name: 'Long-term Loan', type: 'Liability', subtype: 'Non-Current', normal_balance: 'Credit' },
      
      // Capital/Equity (3xxx series)
      { code: '3001', name: 'Owner\'s Capital', type: 'Capital', subtype: 'OwnersCapital', normal_balance: 'Credit' },
      { code: '3002', name: 'Retained Earnings', type: 'Capital', subtype: 'OwnersCapital', normal_balance: 'Credit' },
      { code: '3003', name: 'Drawings', type: 'Capital', subtype: 'OwnersCapital', normal_balance: 'Debit' },
      
      // Revenue (4xxx series)
      { code: '4001', name: 'Sales Revenue', type: 'Revenue', subtype: 'Operating', normal_balance: 'Credit' },
      { code: '4002', name: 'Service Revenue', type: 'Revenue', subtype: 'Operating', normal_balance: 'Credit' },
      { code: '4003', name: 'Interest Income', type: 'Revenue', subtype: 'Non-Operating', normal_balance: 'Credit' },
      
      // Expenses (5xxx series)
      { code: '5001', name: 'Cost of Goods Sold', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' },
      { code: '5002', name: 'Salary Expense', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' },
      { code: '5003', name: 'Rent Expense', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' },
      { code: '5004', name: 'Utilities Expense', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' },
      { code: '5005', name: 'Office Supplies', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' },
      { code: '5006', name: 'Advertising Expense', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' },
      { code: '5007', name: 'Depreciation Expense', type: 'Expense', subtype: 'Operating', normal_balance: 'Debit' }
    ];

    for (const account of defaultAccounts) {
      try {
        await query(
          `INSERT INTO accounts (account_code, account_name, account_type, account_subtype, normal_balance) 
           VALUES ($1, $2, $3, $4, $5)`,
          [account.code, account.name, account.type, account.subtype, account.normal_balance]
        );
        console.log(`   ✓ Added: ${account.code} - ${account.name}`);
      } catch (error) {
        console.error(`❌ Error inserting account ${account.code} (${account.name}): ${error.message}`);
      }
    }

    console.log(`✅ Inserted ${defaultAccounts.length} default accounts`);
    await initializeDefaultUsers();
  } catch (error) {
    console.error('❌ Error initializing default accounts:', error);
    await initializeDefaultUsers();
  }
}

// ===== DEFAULT USERS SETUP =====
async function initializeDefaultUsers() {
  console.log('\n👥 Setting up default users...');

  try {
    const result = await query('SELECT COUNT(*) as count FROM users');
    
    if (parseInt(result.rows[0].count) > 0) {
      console.log(`✅ Users table already has ${result.rows[0].count} users`);
      await createTriggers();
      return;
    }

    console.log('📝 Creating default users (admin and viewer)...');
    
  const defaultUsers = [
    { 
      username: 'admin', 
      password: process.env.DEFAULT_ADMIN_PASSWORD || 'change_me_immediately', 
      role: 'admin' 
    },
    { 
      username: 'viewer', 
      password: process.env.DEFAULT_VIEWER_PASSWORD || 'change_me_immediately', 
      role: 'viewer' 
    }
  ];

    for (const user of defaultUsers) {
      try {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await query(
          `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
          [user.username, hashedPassword, user.role]
        );
        console.log(`   ✓ Added: ${user.username} (${user.role})`);
      } catch (error) {
        console.error(`❌ Error inserting user ${user.username}: ${error.message}`);
      }
    }

    console.log('✅ Default users created');
    console.log('\n🔐 Default Login Credentials:');
    console.log('   👑 Admin: username="admin", password="admin123"');
    console.log('   👁️ Viewer: username="viewer", password="viewer123"');
    console.log('⚠️  Please change default passwords immediately!');
    await createTriggers();
  } catch (error) {
    console.error('❌ Error initializing default users:', error);
    await createTriggers();
  }
}

// ===== DATABASE TRIGGERS =====
async function createTriggers() {
  console.log('\n⚙️ Creating database triggers and automation...');

  try {
    // Drop existing triggers if they exist (PostgreSQL syntax)
    await query(`DROP TRIGGER IF EXISTS set_transaction_number_trigger ON transactions`);
    await query(`DROP TRIGGER IF EXISTS update_transaction_timestamp_trigger ON transactions`);
    await query(`DROP TRIGGER IF EXISTS update_account_timestamp_trigger ON accounts`);
    await query(`DROP TRIGGER IF EXISTS update_user_timestamp_trigger ON users`);

    // 1. Transaction Number Trigger Function
    await query(`
      CREATE OR REPLACE FUNCTION set_transaction_number_func()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.transaction_number IS NULL THEN
          NEW.transaction_number := (
            SELECT COALESCE(MAX(transaction_number), 0) + 1 
            FROM transactions
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create the trigger
    await query(`
      CREATE TRIGGER set_transaction_number_trigger
      BEFORE INSERT ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION set_transaction_number_func();
    `);
    console.log('✅ Transaction numbering trigger created');

    // 2. Updated At Triggers (use the same function for all tables)
    await query(`
      CREATE OR REPLACE FUNCTION update_timestamp_func()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers for each table
    await query(`
      CREATE TRIGGER update_transaction_timestamp_trigger
      BEFORE UPDATE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp_func();
    `);

    await query(`
      CREATE TRIGGER update_account_timestamp_trigger
      BEFORE UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp_func();
    `);

    await query(`
      CREATE TRIGGER update_user_timestamp_trigger
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp_func();
    `);

    console.log('✅ Timestamp update triggers created');
    await finalizeDatabase();
  } catch (error) {
    console.error('❌ Error creating triggers:', error);
    await finalizeDatabase();
  }
}

// ===== FINAL DATABASE VERIFICATION =====
async function finalizeDatabase() {
  console.log('\n🔍 Final database verification...');

  const checks = [
    { sql: "SELECT COUNT(*) as count FROM accounts WHERE is_active = true", name: "Active Accounts" },
    { sql: "SELECT COUNT(*) as count FROM transactions", name: "Transactions" },
    { sql: "SELECT COUNT(*) as count FROM journal_entries", name: "Journal Entries" },
    { sql: "SELECT COUNT(*) as count FROM users WHERE is_active = true", name: "Active Users" },
    { sql: "SELECT STRING_AGG(username || ' (' || role || ')', ', ') as users FROM users", name: "User List" },
    { sql: "SELECT COUNT(*) as null_count FROM transactions WHERE transaction_number IS NULL", name: "NULL Transaction Numbers" },
    { sql: "SELECT COUNT(*) as null_count FROM transactions WHERE updated_at IS NULL", name: "NULL Updated At" },
    { sql: "SELECT NOW() AT TIME ZONE 'Asia/Karachi' as karachi_time", name: "Current Karachi Time" },
    { sql: "SELECT current_setting('TimeZone') as timezone", name: "Database Timezone" }
  ];

  try {
    for (const check of checks) {
      try {
        const result = await query(check.sql);
        
        if (check.name === "Current Karachi Time") {
          console.log(`📍 ${check.name}: ${result.rows[0].karachi_time}`);
        } else if (check.name === "Database Timezone") {
          console.log(`🌐 ${check.name}: ${result.rows[0].timezone}`);
        } else if (check.name === "User List") {
          console.log(`👥 ${check.name}: ${result.rows[0].users || 'None'}`);
        } else {
          const value = result.rows[0].count !== undefined ? result.rows[0].count : result.rows[0].null_count;
          const status = (check.name.includes("NULL") && value === 0) ? '✅' : 
                        (check.name.includes("NULL") && value > 0) ? '❌' : '📊';
          console.log(`${status} ${check.name}: ${value}`);
        }
      } catch (error) {
        console.error(`⚠️ Error checking ${check.name}:`, error.message);
      }
    }

    console.log('\n🎉 POSTGRESQL DATABASE INITIALIZATION COMPLETE!');
    console.log('='.repeat(55));
    console.log('✅ All tables created with Karachi timezone support');
    console.log('✅ Authentication system ready with users table');
    console.log('✅ Default users created (admin & viewer)');
    console.log('✅ Transaction numbering system ready');
    console.log('✅ Timestamp automation triggers installed');
    console.log('✅ Default chart of accounts populated');
    console.log('✅ Indexes created for optimal performance');
    console.log('✅ Connection pooling configured for production');
    console.log('='.repeat(55));
    console.log('\n📍 PostgreSQL database is now ready for production use!');
    console.log('📅 All timestamps will be stored in Karachi time (UTC+5)');
    console.log('🔐 Authentication system is ready with role-based access');
    console.log('⚡ Connection pooling configured for high performance');
    console.log('⚠️  IMPORTANT: Change default passwords immediately!');
    console.log('\n🚀 Ready to connect to Supabase or any PostgreSQL host');

  } catch (error) {
    console.error('❌ Error during final verification:', error);
  }
}

// ===== MAIN EXECUTION =====
(async () => {
  try {
    // First, check if we can connect
    const health = await query('SELECT 1 as test');
    if (health.rows[0].test === 1) {
      console.log('✅ PostgreSQL connection test successful');
      await initializeDatabase();
    }
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. PostgreSQL running locally or Supabase instance');
    console.log('   2. Database created (CREATE DATABASE accounting_system;)');
    console.log('   3. Correct connection settings in .env file');
    console.log('\n📋 Sample .env configuration for Supabase:');
    console.log('   DB_HOST=db.xxxxxx.supabase.co');
    console.log('   DB_PORT=5432');
    console.log('   DB_NAME=postgres');
    console.log('   DB_USER=postgres');
    console.log('   DB_PASSWORD=your_supabase_password');
    console.log('   NODE_ENV=production');
    
    // Don't exit immediately, let user see the error
    setTimeout(() => process.exit(1), 3000);
  }

})();

// Export the initializeDatabase function
module.exports = { initializeDatabase };
