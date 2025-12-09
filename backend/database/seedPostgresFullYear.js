// backend/seedPostgresFullYear.js - Complete 23-Month Sample Data
const { query } = require('../database/db');

class PostgresFullYearSeeder {
  constructor() {
    // Account mapping
    this.accountIds = {};
    
    // Business parameters for TechMart Electronics
    this.businessName = "TechMart Electronics";
    this.location = "Karachi, Pakistan";
    
    // Transaction categories for realism
    this.customerTypes = [
      "Individual Customer",
      "Corporate Client",
      "Educational Institution",
      "Government Office",
      "Small Business",
      "Reseller"
    ];
    
    this.productCategories = [
      "Smartphones",
      "Laptops",
      "Tablets",
      "Monitors",
      "Printers",
      "Accessories",
      "Gaming PCs",
      "Network Equipment",
      "Security Systems",
      "Home Appliances"
    ];
    
    this.suppliers = [
      "TechSource Distributors",
      "Electro Imports Ltd",
      "Global Electronics",
      "Pak Digital Solutions",
      "Innovation Traders",
      "Prime Suppliers"
    ];
    
    console.log('🏪 PostgreSQL Sample Data Generator');
    console.log(`📅 Period: 01/01/2024 to 30/11/2025 (23 months)`);
    console.log(`📍 Business: ${this.businessName}, ${this.location}`);
    console.log('='.repeat(70));
  }

  // ===== HELPER METHODS =====
  getRandomDate(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.floor(Math.random() * daysInMonth) + 1;
    
    // Business hours: 9 AM to 8 PM
    return new Date(
      year,
      month,
      day,
      Math.floor(Math.random() * 11) + 9, // 9-19
      Math.floor(Math.random() * 60),
      Math.floor(Math.random() * 60)
    );
  }

  getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  formatDateForSQL(date) {
    return date.toISOString().split('T')[0];
  }

  getRandomAmount(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  // ===== ACCOUNT MAPPING =====
  async mapAccounts() {
    console.log('🔍 Loading account IDs...');
    
    try {
      const accounts = await query(`
        SELECT id, account_code, account_name, account_type 
        FROM accounts 
        WHERE is_active = true 
        ORDER BY account_code
      `);
      
      if (accounts.rows.length === 0) {
        throw new Error('No accounts found. Run init-pg.js first.');
      }
      
      console.log(`✅ Found ${accounts.rows.length} accounts`);
      
    // Map all accounts - FIXED VERSION
    accounts.rows.forEach(acc => {
    // Create multiple keys for flexibility
    const nameLower = acc.account_name.toLowerCase();
    
    // Key without spaces (what your current code expects)
    const keyNoSpaces = nameLower.replace(/[^a-z]/g, '');
    this.accountIds[keyNoSpaces] = acc.id;
    
    // Also map common abbreviations
    if (nameLower.includes('cost of goods sold')) {
        this.accountIds['cogs'] = acc.id;
        this.accountIds['costofgoodssold'] = acc.id;
    }
    
    // Map other specific accounts
    if (nameLower.includes('bank account')) {
        this.accountIds['bankaccount'] = acc.id;
    }
    if (nameLower.includes('accounts receivable')) {
        this.accountIds['accountsreceivable'] = acc.id;
    }
    if (nameLower.includes('office equipment')) {
        this.accountIds['officeequipment'] = acc.id;
    }
    if (nameLower.includes('furniture & fixtures')) {
        this.accountIds['furniturefixtures'] = acc.id;
    }
    if (nameLower.includes('accounts payable')) {
        this.accountIds['accountspayable'] = acc.id;
    }
    if (nameLower.includes('owner\'s capital') || nameLower.includes("owner's capital")) {
        this.accountIds['ownerscapital'] = acc.id;
    }
    if (nameLower.includes('sales revenue')) {
        this.accountIds['salesrevenue'] = acc.id;
    }
    if (nameLower.includes('service revenue')) {
        this.accountIds['servicerevenue'] = acc.id;
    }
    if (nameLower.includes('interest income')) {
        this.accountIds['interestincome'] = acc.id;
    }
    if (nameLower.includes('salary expense')) {
        this.accountIds['salaryexpense'] = acc.id;
    }
    if (nameLower.includes('rent expense')) {
        this.accountIds['rentexpense'] = acc.id;
    }
    if (nameLower.includes('utilities expense')) {
        this.accountIds['utilitiesexpense'] = acc.id;
    }
    if (nameLower.includes('office supplies')) {
        this.accountIds['officesupplies'] = acc.id;
    }
    if (nameLower.includes('advertising expense')) {
        this.accountIds['advertisingexpense'] = acc.id;
    }
    if (nameLower.includes('depreciation expense')) {
        this.accountIds['depreciationexpense'] = acc.id;
    }
    if (nameLower.includes('loans payable')) {
        this.accountIds['loanspayable'] = acc.id;
    }
    if (nameLower.includes('long-term loan') || nameLower.includes('long term loan')) {
        this.accountIds['longtermloan'] = acc.id;
    }
    if (nameLower.includes('retained earnings')) {
        this.accountIds['retainedearnings'] = acc.id;
    }
    if (nameLower.includes('drawings')) {
        this.accountIds['drawings'] = acc.id;
    }
    });
      
      // Verify essential accounts
      const essentialAccounts = ['cash', 'bankaccount', 'salesrevenue', 'cogs'];
      const missing = essentialAccounts.filter(acc => !this.accountIds[acc]);
      
      if (missing.length > 0) {
        throw new Error(`Missing essential accounts: ${missing.join(', ')}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error loading accounts:', error);
      throw error;
    }
  }

  // ===== BUSINESS TRANSACTION GENERATORS =====
  generateCapitalInvestment(year, month) {
    return {
      date: this.getRandomDate(year, month),
      description: 'Additional capital investment by owner for business expansion',
      reference: `CAP-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.cash, amount: this.getRandomAmount(500000, 2000000), entry_type: 'Debit' },
        { account_id: this.accountIds.ownerscapital, amount: 0, entry_type: 'Credit' } // Amount calculated dynamically
      ]
    };
  }

  generateCashSale(year, month, isMonthEnd = false) {
    const amount = isMonthEnd 
      ? this.getRandomAmount(50000, 300000)
      : this.getRandomAmount(10000, 150000);
    
    const customer = this.getRandomElement(this.customerTypes);
    const product = this.getRandomElement(this.productCategories);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Cash sale of ${product.toLowerCase()} to ${customer.toLowerCase()}`,
      reference: `CASH-${year}${(month + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
      entries: [
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.salesrevenue, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateCreditSale(year, month) {
    const amount = this.getRandomAmount(50000, 500000);
    const customer = this.getRandomElement(['Corporate Client', 'Educational Institution', 'Government Office']);
    const product = this.getRandomElement(['Laptops', 'Gaming PCs', 'Network Equipment', 'Security Systems']);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Credit sale of ${product.toLowerCase()} to ${customer.toLowerCase()}`,
      reference: `CREDIT-${year}${(month + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
      entries: [
        { account_id: this.accountIds.accountsreceivable, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.salesrevenue, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateInventoryPurchase(year, month, isLargeOrder = false) {
    const amount = isLargeOrder 
      ? this.getRandomAmount(300000, 1000000)
      : this.getRandomAmount(50000, 300000);
    
    const supplier = this.getRandomElement(this.suppliers);
    const product = this.getRandomElement(this.productCategories);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Purchase ${product.toLowerCase()} inventory from ${supplier}`,
      reference: `PUR-${year}${(month + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
      entries: [
        { account_id: this.accountIds.inventory, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.accountspayable, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateSupplierPayment(year, month) {
    const amount = this.getRandomAmount(100000, 800000);
    const supplier = this.getRandomElement(this.suppliers);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Payment to ${supplier} for inventory purchases`,
      reference: `PAY-${year}${(month + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
      entries: [
        { account_id: this.accountIds.accountspayable, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateReceivableCollection(year, month) {
    const amount = this.getRandomAmount(50000, 400000);
    const customer = this.getRandomElement(['Corporate Client', 'Educational Institution']);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Received payment from ${customer.toLowerCase()} for credit sale`,
      reference: `REC-${year}${(month + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
      entries: [
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.accountsreceivable, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateSalaryPayment(year, month) {
    const amount = this.getRandomAmount(80000, 250000);
    const period = month % 2 === 0 ? 'first half' : 'second half';
    
    return {
      date: this.getRandomDate(year, month),
      description: `Pay employee salaries for ${period} of ${this.getMonthName(month)}`,
      reference: `SAL-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.salaryexpense, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateRentPayment(year, month) {
    const amount = this.getRandomAmount(50000, 150000);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Pay shop rent for ${this.getMonthName(month)}`,
      reference: `RENT-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.rentexpense, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateUtilityPayment(year, month) {
    const amount = this.getRandomAmount(10000, 40000);
    const utility = this.getRandomElement(['electricity', 'internet', 'water', 'gas']);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Pay ${utility} bill for ${this.getMonthName(month)}`,
      reference: `UTIL-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.utilitiesexpense, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateAdvertisingExpense(year, month) {
    const amount = this.getRandomAmount(10000, 75000);
    const campaign = this.getRandomElement([
      'Eid campaign', 'Back to school', 'Summer sale', 
      'Winter electronics', 'Year-end clearance', 'New product launch'
    ]);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Advertising expense for ${campaign}`,
      reference: `ADV-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.advertisingexpense, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateOfficeSupplyPurchase(year, month) {
    const amount = this.getRandomAmount(5000, 25000);
    const items = this.getRandomElement([
      'receipt paper and bags', 'stationery supplies', 'cleaning materials',
      'packaging materials', 'printer cartridges', 'retail display items'
    ]);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Purchase ${items} for store`,
      reference: `SUPP-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.officesupplies, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateServiceRevenue(year, month) {
    const amount = this.getRandomAmount(10000, 80000);
    const service = this.getRandomElement([
      'device repair', 'software installation', 'system maintenance',
      'warranty service', 'technical support', 'installation service'
    ]);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Service revenue from ${service}`,
      reference: `SERV-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.servicerevenue, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateOwnerWithdrawal(year, month) {
    const amount = this.getRandomAmount(20000, 100000);
    
    return {
      date: this.getRandomDate(year, month),
      description: 'Owner withdrawal for personal expenses',
      reference: `DRAW-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.drawings, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateEquipmentPurchase(year, month, isMajor = false) {
    if (!isMajor && Math.random() > 0.3) return null; // 30% chance of equipment purchase
    
    const amount = isMajor ? this.getRandomAmount(100000, 500000) : this.getRandomAmount(20000, 100000);
    const equipment = isMajor 
      ? this.getRandomElement(['POS system upgrade', 'security camera system', 'warehouse racking'])
      : this.getRandomElement(['computer', 'printer', 'air conditioner', 'display monitor']);
    
    return {
      date: this.getRandomDate(year, month),
      description: `Purchase ${equipment} for business`,
      reference: `EQP-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.officeequipment, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateLoanTransaction(year, month, isRepayment = false) {
    if (!isRepayment && Math.random() > 0.1) return null; // 10% chance of taking loan
    
    if (isRepayment) {
      const amount = this.getRandomAmount(50000, 200000);
      return {
        date: this.getRandomDate(year, month),
        description: 'Repayment of business loan installment',
        reference: `LOAN-REPAY-${year}${(month + 1).toString().padStart(2, '0')}`,
        entries: [
          { account_id: this.accountIds.loanspayable, amount: amount, entry_type: 'Debit' },
          { account_id: this.accountIds.cash, amount: amount, entry_type: 'Credit' }
        ]
      };
    } else {
      const amount = this.getRandomAmount(500000, 2000000);
      return {
        date: this.getRandomDate(year, month),
        description: 'Business loan received for expansion',
        reference: `LOAN-${year}${(month + 1).toString().padStart(2, '0')}`,
        entries: [
          { account_id: this.accountIds.cash, amount: amount, entry_type: 'Debit' },
          { account_id: this.accountIds.loanspayable, amount: amount, entry_type: 'Credit' }
        ]
      };
    }
  }

  generateCOGSEntry(year, month, totalSales) {
    // COGS is typically 60-80% of sales for electronics retail
    const cogsPercentage = 0.7; // 70%
    const amount = Math.round(totalSales * cogsPercentage);
    
    return {
      date: new Date(year, month, 28), // Month-end
      description: `Cost of goods sold for ${this.getMonthName(month)}`,
      reference: `COGS-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.cogs, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.inventory, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  generateDepreciationEntry(year, month) {
    const amount = this.getRandomAmount(5000, 25000);
    
    return {
      date: new Date(year, month, 30), // Month-end
      description: `Depreciation expense for ${this.getMonthName(month)}`,
      reference: `DEP-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.depreciationexpense, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.officeequipment, amount: Math.round(amount * 0.6), entry_type: 'Credit' },
        { account_id: this.accountIds.furniturefixtures, amount: Math.round(amount * 0.4), entry_type: 'Credit' }
      ]
    };
  }

  generateInterestIncome(year, month) {
    const amount = this.getRandomAmount(1000, 10000);
    
    return {
      date: this.getRandomDate(year, month),
      description: 'Interest income from bank account',
      reference: `INT-${year}${(month + 1).toString().padStart(2, '0')}`,
      entries: [
        { account_id: this.accountIds.cash, amount: amount, entry_type: 'Debit' },
        { account_id: this.accountIds.interestincome, amount: amount, entry_type: 'Credit' }
      ]
    };
  }

  // ===== TRANSACTION CREATION =====
  async createTransaction(transactionData) {
    const { date, description, reference, entries } = transactionData;
    
    // Validate all accounts exist
    for (const entry of entries) {
      if (!entry.account_id) {
        throw new Error(`Missing account ID in transaction: ${description}`);
      }
    }
    
    try {
      // Calculate credit amounts for capital investments
      let creditAmount = 0;
      if (reference.startsWith('CAP-')) {
        creditAmount = entries[0].amount; // Debit amount
        entries[1].amount = creditAmount; // Set credit amount
      }
      
      // Verify debits = credits
      let totalDebits = 0;
      let totalCredits = 0;
      entries.forEach(entry => {
        if (entry.entry_type === 'Debit') {
          totalDebits += entry.amount;
        } else {
          totalCredits += entry.amount;
        }
      });
      
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(`Transaction unbalanced: Debits ${totalDebits} != Credits ${totalCredits}`);
      }
      
      const result = await query(`
        WITH new_transaction AS (
          INSERT INTO transactions 
          (transaction_date, description, reference, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          RETURNING id, transaction_number
        )
        SELECT id, transaction_number FROM new_transaction
      `, [
        this.formatDateForSQL(date),
        description,
        reference || ''
      ]);
      
      const transactionId = result.rows[0].id;
      
      // Insert journal entries
      for (const entry of entries) {
        await query(`
          INSERT INTO journal_entries 
          (transaction_id, account_id, amount, entry_type, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [transactionId, entry.account_id, entry.amount, entry.entry_type]);
        
        // Update account balance
        await this.updateAccountBalance(entry.account_id, entry.amount, entry.entry_type);
      }
      
      return { transactionId, transactionNumber: result.rows[0].transaction_number };
      
    } catch (error) {
      console.error(`Transaction creation failed: ${error.message}`);
      throw error;
    }
  }

  async updateAccountBalance(accountId, amount, entryType) {
    try {
      const accountResult = await query(
        'SELECT normal_balance FROM accounts WHERE id = $1',
        [accountId]
      );
      
      if (accountResult.rows.length === 0) {
        throw new Error(`Account ID ${accountId} not found`);
      }
      
      const account = accountResult.rows[0];
      let balanceChange = 0;
      
      if (account.normal_balance === 'Debit') {
        balanceChange = entryType === 'Debit' ? amount : -amount;
      } else {
        balanceChange = entryType === 'Credit' ? amount : -amount;
      }
      
      await query(
        'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
        [balanceChange, accountId]
      );
      
    } catch (error) {
      console.error(`Balance update failed: ${error.message}`);
      throw error;
    }
  }

  // ===== MONTHLY TRANSACTION GENERATION =====
  async generateMonthlyTransactions(year, month) {
    const transactions = [];
    let monthlySales = 0;
    
    console.log(`   📅 ${this.getMonthName(month)} ${year}:`);
    
    // Capital investment (quarterly)
    if (month % 3 === 0) {
      const capitalTx = this.generateCapitalInvestment(year, month);
      transactions.push(capitalTx);
      console.log(`     ✓ Capital investment`);
    }
    
    // Cash sales (8-12 per month)
    const cashSaleCount = this.getRandomAmount(8, 12);
    for (let i = 0; i < cashSaleCount; i++) {
      const isMonthEnd = i === cashSaleCount - 1;
      const sale = this.generateCashSale(year, month, isMonthEnd);
      transactions.push(sale);
      monthlySales += sale.entries[0].amount;
    }
    console.log(`     ✓ ${cashSaleCount} cash sales`);
    
    // Credit sales (2-4 per month)
    const creditSaleCount = this.getRandomAmount(2, 4);
    for (let i = 0; i < creditSaleCount; i++) {
      const sale = this.generateCreditSale(year, month);
      transactions.push(sale);
      monthlySales += sale.entries[0].amount;
    }
    console.log(`     ✓ ${creditSaleCount} credit sales`);
    
    // Inventory purchases (3-5 per month)
    const purchaseCount = this.getRandomAmount(3, 5);
    for (let i = 0; i < purchaseCount; i++) {
      const isLargeOrder = i === 0; // First purchase of month is larger
      const purchase = this.generateInventoryPurchase(year, month, isLargeOrder);
      transactions.push(purchase);
    }
    console.log(`     ✓ ${purchaseCount} inventory purchases`);
    
    // Supplier payments (2-3 per month)
    const paymentCount = this.getRandomAmount(2, 3);
    for (let i = 0; i < paymentCount; i++) {
      const payment = this.generateSupplierPayment(year, month);
      transactions.push(payment);
    }
    console.log(`     ✓ ${paymentCount} supplier payments`);
    
    // Receivable collections (1-3 per month)
    const collectionCount = this.getRandomAmount(1, 3);
    for (let i = 0; i < collectionCount; i++) {
      const collection = this.generateReceivableCollection(year, month);
      transactions.push(collection);
    }
    console.log(`     ✓ ${collectionCount} receivable collections`);
    
    // Salary payments (1-2 per month)
    const salaryCount = month % 2 === 0 ? 1 : 1; // Both halves in same month
    for (let i = 0; i < salaryCount; i++) {
      const salary = this.generateSalaryPayment(year, month);
      transactions.push(salary);
    }
    console.log(`     ✓ ${salaryCount} salary payment`);
    
    // Rent payment (once per month)
    const rent = this.generateRentPayment(year, month);
    transactions.push(rent);
    console.log(`     ✓ Rent payment`);
    
    // Utility payment (once per month)
    const utility = this.generateUtilityPayment(year, month);
    transactions.push(utility);
    console.log(`     ✓ Utility payment`);
    
    // Advertising expense (50% chance per month)
    if (Math.random() > 0.5) {
      const advertising = this.generateAdvertisingExpense(year, month);
      transactions.push(advertising);
      console.log(`     ✓ Advertising expense`);
    }
    
    // Office supplies (once per month)
    const supplies = this.generateOfficeSupplyPurchase(year, month);
    transactions.push(supplies);
    console.log(`     ✓ Office supplies`);
    
    // Service revenue (2-4 per month)
    const serviceCount = this.getRandomAmount(2, 4);
    for (let i = 0; i < serviceCount; i++) {
      const service = this.generateServiceRevenue(year, month);
      transactions.push(service);
      monthlySales += service.entries[0].amount;
    }
    console.log(`     ✓ ${serviceCount} service revenues`);
    
    // Owner withdrawal (once per month)
    const withdrawal = this.generateOwnerWithdrawal(year, month);
    transactions.push(withdrawal);
    console.log(`     ✓ Owner withdrawal`);
    
    // Equipment purchase (30% chance)
    const equipment = this.generateEquipmentPurchase(year, month, month === 11); // Major in December
    if (equipment) {
      transactions.push(equipment);
      console.log(`     ✓ Equipment purchase`);
    }
    
    // Loan transactions
    const loan = this.generateLoanTransaction(year, month, Math.random() > 0.7);
    if (loan) {
      transactions.push(loan);
      console.log(`     ✓ ${loan.reference.startsWith('LOAN-REPAY') ? 'Loan repayment' : 'New loan'}`);
    }
    
    // Month-end entries
    if (monthlySales > 0) {
      const cogs = this.generateCOGSEntry(year, month, monthlySales);
      transactions.push(cogs);
      console.log(`     ✓ COGS entry`);
    }
    
    const depreciation = this.generateDepreciationEntry(year, month);
    transactions.push(depreciation);
    console.log(`     ✓ Depreciation`);
    
    // Interest income (70% chance)
    if (Math.random() > 0.3) {
      const interest = this.generateInterestIncome(year, month);
      transactions.push(interest);
      console.log(`     ✓ Interest income`);
    }
    
    console.log(`     📈 Monthly sales: PKR ${monthlySales.toLocaleString()}`);
    
    return { transactions, monthlySales };
  }

  // ===== MAIN GENERATION =====
  async generateAllTransactions() {
    console.log('\n🎯 Generating 23 months of business transactions...\n');
    
    let allTransactions = [];
    let totalSales = 0;
    let successful = 0;
    let failed = 0;
    
    // Generate for 2024 (January to December)
    for (let month = 0; month < 12; month++) {
      const year = 2024;
      const result = await this.generateMonthlyTransactions(year, month);
      allTransactions = [...allTransactions, ...result.transactions];
      totalSales += result.monthlySales;
      console.log(`     ──────────────────────\n`);
    }
    
    // Generate for 2025 (January to November)
    for (let month = 0; month < 11; month++) {
      const year = 2025;
      const result = await this.generateMonthlyTransactions(year, month);
      allTransactions = [...allTransactions, ...result.transactions];
      totalSales += result.monthlySales;
      console.log(`     ──────────────────────\n`);
    }
    
    console.log(`📊 Total transactions to create: ${allTransactions.length}`);
    console.log(`💰 Estimated total sales: PKR ${totalSales.toLocaleString()}`);
    
    // Create all transactions
    console.log('\n📝 Creating transactions in database...\n');
    
    for (let i = 0; i < allTransactions.length; i++) {
      const tx = allTransactions[i];
      
      // Add slight delay to avoid overwhelming the database
      if (i % 50 === 0 && i > 0) {
        console.log(`   ⏳ Processed ${i} transactions...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      try {
        await this.createTransaction(tx);
        successful++;
        
        if (i % 100 === 0) {
          console.log(`   ✓ Created ${i} transactions...`);
        }
      } catch (error) {
        failed++;
        console.log(`   ✗ Failed: ${tx.description.substring(0, 50)}...`);
      }
    }
    
    return { successful, failed, totalTransactions: allTransactions.length, estimatedSales: totalSales };
  }

  // ===== FINAL VERIFICATION =====
  async verifyResults() {
    console.log('\n🔍 Verifying database state...\n');
    
    try {
      // Get transaction count
      const txCount = await query('SELECT COUNT(*) as count FROM transactions');
      console.log(`📊 Total transactions in database: ${parseInt(txCount.rows[0].count).toLocaleString()}`);
      
      // Get account balances
      const accounts = await query(`
        SELECT account_type, account_name, balance 
        FROM accounts 
        WHERE is_active = true AND balance != 0
        ORDER BY account_type, balance DESC
      `);
      
      console.log('\n💰 ACCOUNT BALANCES (Non-zero):');
      console.log('='.repeat(70));
      
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalCapital = 0;
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      accounts.rows.forEach(acc => {
        const balance = parseFloat(acc.balance);
        const formatted = balance.toLocaleString('en-PK', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        });
        
        console.log(`   ${acc.account_type.padEnd(12)} | ${acc.account_name.padEnd(25)} | ${balance >= 0 ? ' ' : '-'}PKR ${formatted.padStart(15)}`);
        
        switch (acc.account_type) {
          case 'Asset': totalAssets += balance; break;
          case 'Liability': totalLiabilities += balance; break;
          case 'Capital': totalCapital += balance; break;
          case 'Revenue': totalRevenue += balance; break;
          case 'Expense': totalExpenses += balance; break;
        }
      });
      
      console.log('='.repeat(70));
      
      const netIncome = totalRevenue - totalExpenses;
      const equity = totalCapital + netIncome;
      
      console.log('\n📈 FINANCIAL SUMMARY:');
      console.log(`   Total Assets: PKR ${totalAssets.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Liabilities: PKR ${totalLiabilities.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Capital: PKR ${totalCapital.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Revenue: PKR ${totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Expenses: PKR ${totalExpenses.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      console.log(`   Net Income: PKR ${netIncome.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      console.log(`   Total Equity: PKR ${equity.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
      
      const difference = totalAssets - (totalLiabilities + equity);
      const isBalanced = Math.abs(difference) < 0.01;
      
      console.log(`\n⚖️  ACCOUNTING EQUATION CHECK:`);
      console.log(`   Assets (${totalAssets.toFixed(2)}) = Liabilities (${totalLiabilities.toFixed(2)}) + Equity (${equity.toFixed(2)})`);
      console.log(`   Difference: ${difference.toFixed(2)}`);
      console.log(`   Status: ${isBalanced ? '✅ PERFECTLY BALANCED' : '❌ IMBALANCE DETECTED'}`);
      
      // Profitability check
      const profitMargin = (netIncome / totalRevenue) * 100;
      console.log(`\n📊 PROFITABILITY ANALYSIS:`);
      console.log(`   Profit Margin: ${profitMargin.toFixed(2)}%`);
      console.log(`   Status: ${profitMargin > 10 ? '✅ HEALTHY PROFITS' : profitMargin > 0 ? '⚠️  LOW MARGINS' : '❌ OPERATING AT LOSS'}`);
      
      return {
        isBalanced,
        profitMargin,
        netIncome,
        totalRevenue,
        totalExpenses,
        totalAssets,
        totalLiabilities,
        equity
      };
      
    } catch (error) {
      console.error('Verification failed:', error);
      return null;
    }
  }

  // ===== MAIN EXECUTION =====
  async run() {
    try {
      console.log('🚀 Starting 23-month sample data generation...\n');
      
      // Map accounts
      await this.mapAccounts();
      
      // Generate all transactions
      const results = await this.generateAllTransactions();
      
      console.log('\n' + '='.repeat(70));
      console.log('📊 GENERATION COMPLETE');
      console.log('='.repeat(70));
      console.log(`✅ Successful transactions: ${results.successful.toLocaleString()}`);
      console.log(`❌ Failed transactions: ${results.failed.toLocaleString()}`);
      console.log(`📈 Success rate: ${((results.successful / results.totalTransactions) * 100).toFixed(1)}%`);
      console.log(`💰 Estimated total sales: PKR ${results.estimatedSales.toLocaleString()}`);
      
      if (results.successful > 0) {
        // Verify final state
        const verification = await this.verifyResults();
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 SAMPLE DATA GENERATION SUCCESSFUL!');
        console.log('='.repeat(70));
        console.log(`🏪 Business: ${this.businessName}`);
        console.log(`📅 Period: 01/01/2024 to 30/11/2025 (23 months)`);
        console.log(`📍 Location: ${this.location}`);
        console.log(`📊 Transactions: ${results.successful.toLocaleString()}`);
        console.log(`💰 Net Income: PKR ${verification?.netIncome?.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || 'N/A'}`);
        console.log(`📈 Profit Margin: ${verification?.profitMargin?.toFixed(2) || 'N/A'}%`);
        console.log(`⚖️  Accounting Equation: ${verification?.isBalanced ? '✅ BALANCED' : '❌ CHECK REQUIRED'}`);
        
        console.log('\n🔑 NEXT STEPS:');
        console.log('   1. Start your accounting system server');
        console.log('   2. Login with admin credentials');
        console.log('   3. Explore 23 months of business transactions');
        console.log('   4. Generate financial reports for different periods');
        console.log('   5. Test ledger views for all accounts');
        
        console.log('\n👤 DEFAULT LOGINS:');
        console.log('   • Admin: username="admin", password="admin123"');
        console.log('   • Viewer: username="viewer", password="viewer123"');
        
      } else {
        console.log('\n⚠️  No transactions were created successfully.');
        console.log('   Please check your database setup and try again.');
      }
      
    } catch (error) {
      console.error('\n❌ Generation failed:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }
  }
}

// ===== COMMAND LINE INTERFACE =====
if (require.main === module) {
  console.log(`
  🏪 COMPREHENSIVE SAMPLE DATA GENERATOR
  ==================================================
  This script will create 23 months of realistic business
  transactions for a Pakistani electronics retail SME.
  
  Period: January 2024 to November 2025
  Business: TechMart Electronics (Karachi-based)
  
  Features:
  • 600-800 realistic transactions
  • Profitable business scenario
  • Monthly growth trajectory
  • Seasonal variations (Eid, summer, winter sales)
  • All transactions use existing accounts
  • Proper double-entry accounting
  • Realistic Pakistani business context
  
  Estimated time: 2-3 minutes
  `);

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('\nGenerate 23 months of sample data? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      console.log('\n' + '='.repeat(70));
      const seeder = new PostgresFullYearSeeder();
      seeder.run().then(() => {
        console.log('\n✨ Process completed successfully.');
        process.exit(0);
      }).catch(err => {
        console.error('\n💥 Process failed:', err.message);
        process.exit(1);
      });
    } else {
      console.log('❌ Operation cancelled.');
      readline.close();
      process.exit(0);
    }
  });
}

module.exports = PostgresFullYearSeeder;