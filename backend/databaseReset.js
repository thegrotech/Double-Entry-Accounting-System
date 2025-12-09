// backend/databaseReset.js - PostgreSQL Version
const { query, pool } = require('./database/db');

class DatabaseReset {
  // Reset the entire database to initial state
  static async resetDatabase() {
    console.log('🔄 Starting PostgreSQL database reset...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Delete all journal entries
      const journalResult = await client.query('DELETE FROM journal_entries');
      console.log(`✅ Deleted ${journalResult.rowCount} journal entries`);
      
      // 2. Delete all transactions
      const transactionResult = await client.query('DELETE FROM transactions');
      console.log(`✅ Deleted ${transactionResult.rowCount} transactions`);
      
      // 3. Reset account balances to zero but keep account structure
      const accountResult = await client.query(
        'UPDATE accounts SET balance = 0, updated_at = NOW() WHERE is_active = true'
      );
      console.log(`✅ Reset balances for ${accountResult.rowCount} accounts`);
      
      // 4. Reset PostgreSQL sequences
      await client.query("SELECT setval('transactions_id_seq', 1, false)");
      console.log('✅ Reset transaction ID sequence');
      
      await client.query("SELECT setval('journal_entries_id_seq', 1, false)");
      console.log('✅ Reset journal entries ID sequence');
      
      // Note: Don't reset accounts sequence to keep existing account IDs
      
      await client.query('COMMIT');
      
      console.log('🎉 Database reset completed successfully!');
      console.log('📊 All transactions and journal entries have been cleared.');
      console.log('💰 All account balances have been reset to zero.');
      console.log('🔢 Transaction numbering has been reset to start from 1.');
      
      return {
        success: true,
        message: 'Database reset completed successfully',
        details: {
          transactionsDeleted: transactionResult.rowCount,
          journalEntriesDeleted: journalResult.rowCount,
          accountsReset: accountResult.rowCount,
          sequencesReset: ['transactions_id_seq', 'journal_entries_id_seq']
        }
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Database reset failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Safe reset - keeps accounts but clears all transactions
  static async safeReset() {
    console.log('🛡️ Performing safe reset (keeping accounts)...');
    return await this.resetDatabase();
  }

  // Nuclear option - completely recreates the database schema
  static async nuclearReset() {
    console.log('💥 Performing nuclear reset...');
    
    try {
      // Drop and recreate all tables using init-pg.js
      console.log('🔧 Reinitializing database schema...');
      
      // Require and run the init-pg.js
      const initPg = require('./init-pg');
      
      // Close existing pool connections
      await pool.end();
      
      // Note: You'll need to manually restart the app or recreate the pool
      console.log('⚠️  Database pool closed. You need to:');
      console.log('   1. Restart your server');
      console.log('   2. Or manually reconnect to PostgreSQL');
      
      return {
        success: true,
        message: 'Nuclear reset initiated. Restart server to complete.',
        note: 'Database schema will be recreated on next server start.'
      };
      
    } catch (error) {
      console.error('❌ Nuclear reset failed:', error);
      throw error;
    }
  }

  // Get current database statistics
  static async getDatabaseStats() {
    try {
      const stats = {};
      
      // Get all stats in parallel for better performance
      const [
        transactionsResult,
        journalEntriesResult,
        accountsResult,
        tidResult,
        balanceResult
      ] = await Promise.all([
        query('SELECT COUNT(*) as count FROM transactions'),
        query('SELECT COUNT(*) as count FROM journal_entries'),
        query('SELECT COUNT(*) as count FROM accounts WHERE is_active = true'),
        query('SELECT COALESCE(MAX(transaction_number), 0) + 1 as nextTID FROM transactions'),
        query('SELECT SUM(balance) as totalBalance FROM accounts WHERE is_active = true')
      ]);
      
      stats.transactions = parseInt(transactionsResult.rows[0].count);
      stats.journalEntries = parseInt(journalEntriesResult.rows[0].count);
      stats.activeAccounts = parseInt(accountsResult.rows[0].count);
      stats.nextTID = parseInt(tidResult.rows[0].nexttid);
      stats.totalBalance = parseFloat(balanceResult.rows[0].totalbalance) || 0;
      
      // Get some additional PostgreSQL-specific stats
      const dbInfo = await query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          version() as postgres_version,
          current_database() as db_name,
          current_user as db_user
      `);
      
      stats.databaseInfo = dbInfo.rows[0];
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      throw error;
    }
  }

  // Reset specific account balance to zero
  static async resetAccountBalance(accountId) {
    try {
      const result = await query(
        'UPDATE accounts SET balance = 0, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING account_name, account_code',
        [accountId]
      );
      
      if (result.rowCount === 0) {
        throw new Error('Account not found or inactive');
      }
      
      console.log(`✅ Reset balance for account: ${result.rows[0].account_code} - ${result.rows[0].account_name}`);
      
      return {
        success: true,
        message: `Account ${result.rows[0].account_code} balance reset to zero`,
        account: result.rows[0]
      };
    } catch (error) {
      console.error('❌ Error resetting account balance:', error);
      throw error;
    }
  }

  // Reset transaction numbers sequentially
  static async resequenceTransactions() {
    console.log('🔢 Resequencing transaction numbers...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Temporarily set all transaction numbers to negative IDs
      await client.query(`
        UPDATE transactions 
        SET transaction_number = -id 
        WHERE transaction_number IS NOT NULL
      `);
      
      // Update with sequential numbers ordered by creation date
      await client.query(`
        WITH numbered_transactions AS (
          SELECT id, 
                 ROW_NUMBER() OVER (ORDER BY created_at, id) as new_number 
          FROM transactions 
          WHERE transaction_number < 0
        )
        UPDATE transactions 
        SET transaction_number = nt.new_number
        FROM numbered_transactions nt
        WHERE transactions.id = nt.id
      `);
      
      await client.query('COMMIT');
      
      const countResult = await query('SELECT COUNT(*) as count FROM transactions');
      console.log(`✅ Resequenced ${countResult.rows[0].count} transactions`);
      
      return {
        success: true,
        message: 'Transaction numbers resequenced successfully'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error resequencing transactions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Check database health and integrity
  static async checkDatabaseHealth() {
    console.log('🏥 Checking database health...');
    
    try {
      const health = {
        connection: false,
        tables: {},
        issues: []
      };
      
      // Test connection
      const connTest = await query('SELECT 1 as test, NOW() as current_time');
      health.connection = connTest.rows[0].test === 1;
      health.currentTime = connTest.rows[0].current_time;
      
      // Check required tables exist
      const tables = ['accounts', 'transactions', 'journal_entries', 'users'];
      
      for (const table of tables) {
        try {
          const exists = await query(
            `SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            )`,
            [table]
          );
          
          health.tables[table] = exists.rows[0].exists;
          
          if (!exists.rows[0].exists) {
            health.issues.push(`Missing table: ${table}`);
          }
        } catch (error) {
          health.tables[table] = false;
          health.issues.push(`Error checking table ${table}: ${error.message}`);
        }
      }
      
      // Check for orphaned journal entries
      const orphanedResult = await query(`
        SELECT COUNT(*) as count 
        FROM journal_entries je 
        LEFT JOIN transactions t ON je.transaction_id = t.id 
        WHERE t.id IS NULL
      `);
      
      const orphanedCount = parseInt(orphanedResult.rows[0].count);
      health.orphanedEntries = orphanedCount;
      
      if (orphanedCount > 0) {
        health.issues.push(`Found ${orphanedCount} orphaned journal entries`);
      }
      
      // Check accounting equation
      const equationResult = await query(`
        SELECT 
          SUM(CASE WHEN account_type = 'Asset' THEN balance ELSE 0 END) as total_assets,
          SUM(CASE WHEN account_type = 'Liability' THEN balance ELSE 0 END) as total_liabilities,
          SUM(CASE 
            WHEN account_type = 'Capital' AND normal_balance = 'Credit' THEN balance
            WHEN account_type = 'Capital' AND normal_balance = 'Debit' THEN -balance
            ELSE 0 
          END) as total_capital
        FROM accounts 
        WHERE is_active = true
      `);
      
      const totalAssets = parseFloat(equationResult.rows[0].total_assets || 0);
      const totalLiabilities = parseFloat(equationResult.rows[0].total_liabilities || 0);
      const totalCapital = parseFloat(equationResult.rows[0].total_capital || 0);
      const difference = Math.abs(totalAssets - (totalLiabilities + totalCapital));
      
      health.accountingEquation = {
        totalAssets,
        totalLiabilities,
        totalCapital,
        difference,
        isBalanced: difference < 0.01
      };
      
      if (!health.accountingEquation.isBalanced) {
        health.issues.push(`Accounting equation unbalanced. Difference: ${difference.toFixed(2)}`);
      }
      
      // Check for invalid data
      const invalidNormalBalance = await query(`
        SELECT COUNT(*) as count 
        FROM accounts 
        WHERE normal_balance NOT IN ('Debit', 'Credit')
      `);
      
      health.invalidNormalBalances = parseInt(invalidNormalBalance.rows[0].count);
      
      if (health.invalidNormalBalances > 0) {
        health.issues.push(`Found ${health.invalidNormalBalances} accounts with invalid normal balance`);
      }
      
      return health;
      
    } catch (error) {
      console.error('❌ Error checking database health:', error);
      throw error;
    }
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  const param = process.argv[3];
  
  const showUsage = () => {
    console.log(`
📊 PostgreSQL Accounting Database Reset Utility

Usage:
  node databaseReset.js [command] [parameter]

Commands:
  stats                   - Show current database statistics
  health                  - Check database health and integrity
  reset                   - Clear all transactions and reset balances (recommended)
  resequence              - Resequence transaction numbers
  reset-account [id]      - Reset specific account balance to zero
  nuclear                 - Complete reset (requires server restart)
  help                    - Show this help message

Examples:
  node databaseReset.js stats
  node databaseReset.js health
  node databaseReset.js reset
  node databaseReset.js resequence
  node databaseReset.js reset-account 5
  node databaseReset.js nuclear
    `);
  };

  const runCommand = async () => {
    try {
      switch (command) {
        case 'stats':
          console.log('📊 Gathering database statistics...\n');
          const stats = await DatabaseReset.getDatabaseStats();
          
          console.log(`
📊 Current Database Statistics:
  Transactions: ${stats.transactions}
  Journal Entries: ${stats.journalEntries}
  Active Accounts: ${stats.activeAccounts}
  Next TID: ${stats.nextTID}
  Total Balance: ${stats.totalBalance.toFixed(2)}

💾 Database Info:
  Name: ${stats.databaseInfo.db_name}
  User: ${stats.databaseInfo.db_user}
  Size: ${stats.databaseInfo.db_size}
  PostgreSQL: ${stats.databaseInfo.postgres_version.split(',')[0]}
          `);
          break;
          
        case 'health':
          console.log('🏥 Checking database health...\n');
          const health = await DatabaseReset.checkDatabaseHealth();
          
          console.log(`🕐 Current Time: ${health.currentTime}`);
          console.log(`🔗 Connection: ${health.connection ? '✅ Healthy' : '❌ Failed'}`);
          
          console.log('\n📋 Table Status:');
          Object.entries(health.tables).forEach(([table, exists]) => {
            console.log(`  ${table}: ${exists ? '✅ Exists' : '❌ Missing'}`);
          });
          
          console.log('\n🧮 Accounting Equation:');
          console.log(`  Assets: ${health.accountingEquation.totalAssets.toFixed(2)}`);
          console.log(`  Liabilities: ${health.accountingEquation.totalLiabilities.toFixed(2)}`);
          console.log(`  Capital: ${health.accountingEquation.totalCapital.toFixed(2)}`);
          console.log(`  Difference: ${health.accountingEquation.difference.toFixed(2)}`);
          console.log(`  Balanced: ${health.accountingEquation.isBalanced ? '✅ Yes' : '❌ No'}`);
          
          console.log('\n⚠️  Issues Found:');
          if (health.issues.length === 0) {
            console.log('  ✅ No issues found');
          } else {
            health.issues.forEach(issue => console.log(`  ❌ ${issue}`));
          }
          break;
          
        case 'reset':
          console.log('🔄 Resetting database...\n');
          const resetResult = await DatabaseReset.safeReset();
          console.log(`✅ ${resetResult.message}`);
          break;
          
        case 'resequence':
          console.log('🔢 Resequencing transaction numbers...\n');
          const sequenceResult = await DatabaseReset.resequenceTransactions();
          console.log(`✅ ${sequenceResult.message}`);
          break;
          
        case 'reset-account':
          if (!param) {
            console.log('❌ Error: Account ID is required');
            console.log('Usage: node databaseReset.js reset-account [account_id]');
            process.exit(1);
          }
          console.log(`💰 Resetting account ${param} balance...\n`);
          const accountResult = await DatabaseReset.resetAccountBalance(parseInt(param));
          console.log(`✅ ${accountResult.message}`);
          break;
          
        case 'nuclear':
          console.log('⚠️  WARNING: This will require server restart!');
          console.log('Type "YES" to confirm:');
          
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          readline.question('', async (answer) => {
            if (answer === 'YES') {
              try {
                const nuclearResult = await DatabaseReset.nuclearReset();
                console.log(`✅ ${nuclearResult.message}`);
                console.log(`📝 Note: ${nuclearResult.note}`);
              } catch (error) {
                console.error('❌ Nuclear reset failed:', error.message);
                process.exit(1);
              }
            } else {
              console.log('❌ Nuclear reset cancelled.');
            }
            readline.close();
            process.exit(0);
          });
          return; // Don't exit yet, wait for user input
          
        case 'help':
        default:
          showUsage();
          break;
      }
      
      // Close the pool after command execution
      await pool.end();
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Command failed:', error.message);
      console.error('Details:', error);
      
      try {
        await pool.end();
      } catch (e) {
        // Ignore pool closing errors
      }
      
      process.exit(1);
    }
  };

  if (!command || command === 'help') {
    showUsage();
    process.exit(0);
  } else {
    runCommand();
  }
}

module.exports = DatabaseReset;