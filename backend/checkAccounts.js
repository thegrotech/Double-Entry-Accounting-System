// backend/checkAccounts.js
const { query } = require('./database/db');

async function checkAccounts() {
  try {
    console.log('📊 Checking existing accounts in PostgreSQL...\n');
    
    // Get all active accounts
    const result = await query(`
      SELECT 
        id,
        account_code,
        account_name,
        account_type,
        normal_balance,
        balance,
        is_active,
        created_at
      FROM accounts 
      WHERE is_active = true
      ORDER BY account_type, account_code
    `);
    
    console.log(`✅ Found ${result.rows.length} active accounts:\n`);
    
    console.log('📋 ACCOUNT LIST:');
    console.log('='.repeat(100));
    console.log('ID  | Code   | Name                      | Type       | Normal Balance | Balance     | Created');
    console.log('='.repeat(100));
    
    result.rows.forEach(account => {
      console.log(
        `${account.id.toString().padStart(3)} | ` +
        `${account.account_code.padEnd(6)} | ` +
        `${account.account_name.substring(0, 25).padEnd(25)} | ` +
        `${account.account_type.padEnd(10)} | ` +
        `${account.normal_balance.padEnd(15)} | ` +
        `${parseFloat(account.balance).toFixed(2).padStart(10)} | ` +
        `${new Date(account.created_at).toLocaleDateString('en-PK')}`
      );
    });
    
    console.log('='.repeat(100));
    
    // Group by account type
    const grouped = {
      Asset: [],
      Liability: [],
      Capital: [],
      Revenue: [],
      Expense: []
    };
    
    result.rows.forEach(account => {
      if (grouped[account.account_type]) {
        grouped[account.account_type].push(account);
      }
    });
    
    console.log('\n📊 ACCOUNTS BY TYPE:');
    for (const [type, accounts] of Object.entries(grouped)) {
      if (accounts.length > 0) {
        console.log(`\n${type}: (${accounts.length} accounts)`);
        accounts.forEach(acc => {
          console.log(`  ${acc.account_code} - ${acc.account_name}`);
        });
      }
    }
    
    // Check for required accounts
    const requiredAccounts = [
      'Cash',
      'Bank Account', 
      'Accounts Receivable',
      'Inventory',
      'Accounts Payable',
      'Owner\'s Capital',
      'Sales Revenue',
      'Service Revenue',
      'Cost of Goods Sold',
      'Salary Expense',
      'Rent Expense',
      'Utilities Expense'
    ];
    
    console.log('\n🔍 CHECKING REQUIRED ACCOUNTS:');
    console.log('='.repeat(50));
    
    const missingAccounts = [];
    requiredAccounts.forEach(required => {
      const exists = result.rows.some(acc => 
        acc.account_name.toLowerCase() === required.toLowerCase()
      );
      
      if (exists) {
        console.log(`✅ ${required}`);
      } else {
        console.log(`❌ ${required}`);
        missingAccounts.push(required);
      }
    });
    
    console.log('='.repeat(50));
    
    if (missingAccounts.length > 0) {
      console.log(`\n⚠️  Missing ${missingAccounts.length} required accounts:`);
      missingAccounts.forEach(acc => console.log(`   - ${acc}`));
      
      console.log('\n💡 Run the database initialization script to create missing accounts:');
      console.log('   node database/init-pg.js');
    } else {
      console.log('\n🎉 All required accounts are present!');
    }
    
    // Check database connectivity
    console.log('\n🔗 DATABASE CONNECTION TEST:');
    const test = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`✅ Connected to PostgreSQL ${test.rows[0].pg_version.split(',')[0]}`);
    console.log(`✅ Current database time: ${test.rows[0].current_time}`);
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error checking accounts:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  checkAccounts()
    .then(() => {
      console.log('\n✨ Account check completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Account check failed.');
      process.exit(1);
    });
}

module.exports = { checkAccounts };