const express = require('express');
const router = express.Router();
const AccountingModel = require('../models/accountingModel');
const { authenticate, authorize, authorizeAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// ===== HELPER FUNCTIONS =====

// Validate dd/mm/yyyy date format
const isValidDate = (dateStr) => {
    if (!dateStr) return false;
    
    // Check for dd/mm/yyyy format
    const ddMMyyyyRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (!ddMMyyyyRegex.test(dateStr)) return false;
    
    const parts = dateStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    
    return true;
};

// Format error response consistently
const formatErrorResponse = (error, includeStack = false) => {
    return {
        success: false,
        message: error.message || 'An error occurred',
        ...(includeStack && process.env.NODE_ENV === 'development' && { stack: error.stack })
    };
};


// ===== APPLY AUTHENTICATION MIDDLEWARE TO ALL ROUTES =====
router.use(authenticate);

// ===== ACCOUNT MANAGEMENT ROUTES =====

// Get all accounts (all authenticated users)
router.get('/accounts', async (req, res) => {
    try {
        const accounts = await AccountingModel.getAllAccounts();
        res.json({ 
            success: true, 
            data: accounts,
            count: accounts.length 
        });
    } catch (error) {
        console.error('Get all accounts error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get accounts hierarchy (all authenticated users)
router.get('/accounts/hierarchy', async (req, res) => {
    try {
        const hierarchy = await AccountingModel.getAccountsHierarchy();
        res.json({ 
            success: true, 
            data: hierarchy 
        });
    } catch (error) {
        console.error('Get accounts hierarchy error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get account usage (all authenticated users)
router.get('/accounts/:id/usage', async (req, res) => {
    try {
        const accountId = parseInt(req.params.id);
        
        if (!accountId || isNaN(accountId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid account ID is required' 
            });
        }
        
        const usage = await AccountingModel.getAccountUsage(accountId);
        res.json({ 
            success: true, 
            data: usage 
        });
    } catch (error) {
        console.error('Get account usage error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get account by ID (all authenticated users)
router.get('/accounts/:id', async (req, res) => {
    try {
        const accountId = parseInt(req.params.id);
        
        if (!accountId || isNaN(accountId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid account ID is required' 
            });
        }
        
        const account = await AccountingModel.getAccountById(accountId);
        if (!account) {
            return res.status(404).json({ 
                success: false, 
                message: 'Account not found' 
            });
        }
        res.json({ success: true, data: account });
    } catch (error) {
        console.error('Get account by ID error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Create new account (admin only)
router.post('/accounts', authorizeAdmin, async (req, res) => {
    try {
        const result = await AccountingModel.createAccount(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error('Create account error:', error);
        res.status(400).json(formatErrorResponse(error));
    }
});

// Update account (admin only)
router.put('/accounts/:id', authorizeAdmin, async (req, res) => {
    try {
        const accountId = parseInt(req.params.id);
        
        if (!accountId || isNaN(accountId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid account ID is required' 
            });
        }
        
        const result = await AccountingModel.updateAccount(accountId, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Update account error:', error);
        res.status(400).json(formatErrorResponse(error));
    }
});

// Delete account (soft delete) (admin only)
router.delete('/accounts/:id', authorizeAdmin, async (req, res) => {
    try {
        const accountId = parseInt(req.params.id);
        
        if (!accountId || isNaN(accountId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid account ID is required' 
            });
        }
        
        const result = await AccountingModel.deleteAccount(accountId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(400).json(formatErrorResponse(error));
    }
});

// Get accounts by type (all authenticated users)
router.get('/accounts/type/:type', async (req, res) => {
    try {
        const accountType = req.params.type;
        const validTypes = ['Asset', 'Liability', 'Capital', 'Revenue', 'Expense'];
        
        if (!validTypes.includes(accountType)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid account type. Must be: Asset, Liability, Capital, Revenue, or Expense' 
            });
        }
        
        const accounts = await AccountingModel.getAccountsByType(accountType);
        res.json({ 
            success: true, 
            data: accounts,
            count: accounts.length 
        });
    } catch (error) {
        console.error('Get accounts by type error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get chart of accounts (all authenticated users)
router.get('/chart-of-accounts', async (req, res) => {
    try {
        const accounts = await AccountingModel.getChartOfAccounts();
        res.json({ 
            success: true, 
            data: accounts,
            count: accounts.length 
        });
    } catch (error) {
        console.error('Get chart of accounts error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// ===== TRANSACTION MANAGEMENT ROUTES =====

// Create new transaction (admin only)
router.post('/transactions', authorizeAdmin, async (req, res) => {
    try {
        const { date, description, entries } = req.body;
        
        // Basic validation
        if (!date || !description || !entries) {
            return res.status(400).json({ 
                success: false, 
                message: 'Date, description, and entries are required' 
            });
        }
        
        // Validate date format
        if (!isValidDate(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use dd/mm/yyyy format' 
            });
        }
        
        const result = await AccountingModel.createTransaction(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(400).json(formatErrorResponse(error));
    }
});

// Get all transactions (all authenticated users)
router.get('/transactions', async (req, res) => {
    try {
        const transactions = await AccountingModel.getAllTransactions();
        res.json({ 
            success: true, 
            data: transactions,
            count: transactions.length 
        });
    } catch (error) {
        console.error('Get all transactions error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get next transaction number (all authenticated users)
router.get('/transactions/next-number', async (req, res) => {
    try {
        const result = await AccountingModel.getNextTransactionNumber();
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Get next transaction number error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get transactions by date range (all authenticated users)
router.get('/transactions/by-date-range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'startDate and endDate query parameters are required' 
            });
        }
        
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use dd/mm/yyyy format for both dates' 
            });
        }
        
        const transactions = await AccountingModel.getTransactionsByDateRange(startDate, endDate);
        res.json({ 
            success: true, 
            data: transactions,
            count: transactions.length 
        });
    } catch (error) {
        console.error('Get transactions by date range error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get transactions by specific date (all authenticated users)
router.get('/transactions/by-date/:date', async (req, res) => {
    try {
        const date = req.params.date;
        
        if (!date || !isValidDate(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid date in dd/mm/yyyy format is required' 
            });
        }
        
        const transactions = await AccountingModel.getTransactionsByDate(date);
        res.json({ 
            success: true, 
            data: transactions,
            count: transactions.length 
        });
    } catch (error) {
        console.error('Get transactions by date error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Search transactions (all authenticated users)
router.get('/transactions/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Search query is required' 
            });
        }
        
        const transactions = await AccountingModel.searchTransactions(q);
        res.json({ 
            success: true, 
            data: transactions,
            count: transactions.length 
        });
    } catch (error) {
        console.error('Search transactions error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get transaction by ID (all authenticated users)
router.get('/transactions/:id', async (req, res) => {
    try {
        const transactionId = parseInt(req.params.id);
        
        if (!transactionId || isNaN(transactionId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid transaction ID is required' 
            });
        }
        
        const transaction = await AccountingModel.getTransactionById(transactionId);
        res.json({ success: true, data: transaction });
    } catch (error) {
        console.error('Get transaction by ID error:', error);
        
        if (error.message === 'Transaction not found') {
            return res.status(404).json({ 
                success: false, 
                message: 'Transaction not found' 
            });
        }
        
        res.status(500).json(formatErrorResponse(error));
    }
});

// Update transaction (admin only)
router.put('/transactions/:id', authorizeAdmin, async (req, res) => {
    try {
        const transactionId = parseInt(req.params.id);
        const { date, description, reference } = req.body;
        
        if (!transactionId || isNaN(transactionId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid transaction ID is required' 
            });
        }
        
        // Validate date if provided
        if (date && !isValidDate(date)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use dd/mm/yyyy format' 
            });
        }
        
        const result = await AccountingModel.updateTransaction(transactionId, { date, description, reference });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(400).json(formatErrorResponse(error));
    }
});

// Delete transaction (admin only)
router.delete('/transactions/:id', authorizeAdmin, async (req, res) => {
    try {
        const transactionId = parseInt(req.params.id);
        
        if (!transactionId || isNaN(transactionId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid transaction ID is required' 
            });
        }
        
        const result = await AccountingModel.deleteTransaction(transactionId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// ===== FINANCIAL REPORTS ROUTES (all authenticated users) =====

// Get balance sheet (all time)
router.get('/reports/balance-sheet', async (req, res) => {
    try {
        const balanceSheet = await AccountingModel.getBalanceSheet();
        res.json({ success: true, data: balanceSheet });
    } catch (error) {
        console.error('Get balance sheet error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get balance sheet for specific period
router.get('/reports/balance-sheet/period', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'startDate and endDate query parameters are required' 
            });
        }
        
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use dd/mm/yyyy format for both dates' 
            });
        }
        
        const balanceSheet = await AccountingModel.getBalanceSheetForPeriod(startDate, endDate);
        res.json({ success: true, data: balanceSheet });
    } catch (error) {
        console.error('Get balance sheet for period error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get income statement (all time)
router.get('/reports/income-statement', async (req, res) => {
    try {
        const incomeStatement = await AccountingModel.getIncomeStatement();
        res.json({ success: true, data: incomeStatement });
    } catch (error) {
        console.error('Get income statement error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get income statement for specific period
router.get('/reports/income-statement/period', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'startDate and endDate query parameters are required' 
            });
        }
        
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use dd/mm/yyyy format for both dates' 
            });
        }
        
        const incomeStatement = await AccountingModel.getIncomeStatementForPeriod(startDate, endDate);
        res.json({ success: true, data: incomeStatement });
    } catch (error) {
        console.error('Get income statement for period error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get financial ratios (all authenticated users)
router.get('/reports/financial-ratios', async (req, res) => {
    try {
        const ratios = await AccountingModel.getFinancialRatios();
        res.json({ success: true, data: ratios });
    } catch (error) {
        console.error('Get financial ratios error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// ===== LEDGER ROUTES (all authenticated users) =====

// Get account ledger with opening/closing balances
router.get('/reports/ledger/:accountId', async (req, res) => {
    try {
        const accountId = parseInt(req.params.accountId);
        const { startDate, endDate } = req.query;
        
        if (!accountId || isNaN(accountId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid account ID is required' 
            });
        }
        
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'startDate and endDate query parameters are required' 
            });
        }
        
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid date format. Use dd/mm/yyyy format for both dates' 
            });
        }
        
        const ledgerData = await AccountingModel.getAccountLedger(accountId, startDate, endDate);
        res.json({ success: true, data: ledgerData });
    } catch (error) {
        console.error('Get account ledger error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});
// ===== SYSTEM HEALTH ROUTES (admin only) =====

// Validate accounting equation (admin only)
router.get('/system/validate-equation', authorizeAdmin, async (req, res) => {
    try {
        const result = await AccountingModel.validateAccountingEquation();
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Validate accounting equation error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Get system statistics (admin only)
router.get('/system/stats', authorizeAdmin, async (req, res) => {
    try {
        const stats = await AccountingModel.getSystemStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get system stats error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// Debug system (admin only)
router.get('/system/debug', authorizeAdmin, async (req, res) => {
    try {
        const debugInfo = await AccountingModel.debugSystem();
        res.json({ success: true, data: debugInfo });
    } catch (error) {
        console.error('Debug system error:', error);
        res.status(500).json(formatErrorResponse(error));
    }
});

// REMOVED: /debug/fix-all-transactions route
// This was SQLite-specific and not needed for PostgreSQL

// ===== COMPANY CONFIG ROUTES =====

// Get company details (all authenticated users)
router.get('/company-details', (req, res) => {
    try {
        const companyDetailsPath = path.join(__dirname, '../company_details.json');
        if (!fs.existsSync(companyDetailsPath)) {
            return res.status(404).json({
                success: false,
                message: 'Company details configuration not found'
            });
        }
        
        const companyDetails = JSON.parse(fs.readFileSync(companyDetailsPath, 'utf8'));
        res.json({ success: true, data: companyDetails });
    } catch (error) {
        console.error('Error loading company details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load company details'
        });
    }
});

// Update company details (admin only)
router.put('/company-details', authorizeAdmin, (req, res) => {
    try {
        const companyDetailsPath = path.join(__dirname, '../company_details.json');
        const updatedDetails = req.body;
        
        // Basic validation
        if (!updatedDetails.company_name) {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
            });
        }
        
        // Save to file
        fs.writeFileSync(companyDetailsPath, JSON.stringify(updatedDetails, null, 2));
        
        res.json({
            success: true,
            message: 'Company details updated successfully',
            data: updatedDetails
        });
    } catch (error) {
        console.error('Error updating company details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update company details'
        });
    }
});

// ===== 404 HANDLER FOR API ROUTES =====
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});

// ===== ERROR HANDLER FOR API ROUTES =====
router.use((err, req, res, next) => {
    console.error('API Route Error:', err);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

module.exports = router;