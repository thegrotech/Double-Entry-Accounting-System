// backend/models/accountingModel.js - PostgreSQL Production Ready
const { query } = require('../database/db');

class AccountingModel {
  // ===== PAKISTAN TIME HELPER METHODS =====
  
  static getPakistanTime() {
    const now = new Date();
    
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      date_dd_mm_yyyy: `${day}/${month}/${year}`,
      time: `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`,
      ampm: ampm,
      fullDateTime: `${year}-${month}-${day} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
      timestamp: `${year}-${month}-${day} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`,
      isoString: now.toISOString()
    };
  }

  static formatDateToPakistan(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        if (typeof dateString === 'string') {
          if (dateString.includes('/') && dateString.includes(':')) {
            return dateString;
          }
        }
        return '';
      }

      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      hours = hours % 12;
      hours = hours ? hours : 12;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  static formatDateOnly(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date only:', error);
      return '';
    }
  }

  static convertToYYYYMMDD(dateStr) {
    if (!dateStr) return null;
    
    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      
      if (dateStr.includes('-') && !dateStr.includes('T')) {
        return dateStr;
      }
      
      return dateStr;
    } catch (error) {
      console.error('Error converting date:', error);
      return dateStr;
    }
  }

  static convertToDDMMYYYY(dateStr) {
    if (!dateStr) return '';
    
    try {
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      return dateStr;
    } catch (error) {
      console.error('Error converting date:', error);
      return dateStr;
    }
  }

  // ===== ACCOUNT MANAGEMENT METHODS =====

  static validateAccountData(accountData) {
    const { account_name, account_type, normal_balance } = accountData;
    
    if (!account_name || account_name.trim() === '') {
      throw new Error('Account name is required');
    }
    
    const validAccountTypes = ['Asset', 'Liability', 'Capital', 'Revenue', 'Expense'];
    if (!account_type || !validAccountTypes.includes(account_type)) {
      throw new Error(`Account type must be one of: ${validAccountTypes.join(', ')}`);
    }
    
    if (!normal_balance || !['Debit', 'Credit'].includes(normal_balance)) {
      throw new Error('Normal balance must be either Debit or Credit');
    }
    
    if (account_name.length > 100) {
      throw new Error('Account name must be less than 100 characters');
    }
    
    if (account_type === 'Asset' || account_type === 'Liability') {
      const validSubtypes = ['Current', 'Non-Current'];
      if (accountData.account_subtype && !validSubtypes.includes(accountData.account_subtype)) {
        throw new Error(`${account_type} accounts must have subtype: Current or Non-Current`);
      }
    }
    
    return true;
  }

  static async getAllAccounts() {
    try {
      const result = await query(
        `SELECT * FROM accounts WHERE is_active = true ORDER BY account_code`
      );
      
      const formattedRows = result.rows.map(account => ({
        ...account,
        balance: parseFloat(account.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(account.created_at),
        updated_at_formatted: this.formatDateToPakistan(account.updated_at),
        date_created_formatted: this.formatDateOnly(account.created_at)
      }));
      
      return formattedRows;
    } catch (error) {
      console.error('Get all accounts error:', error);
      throw error;
    }
  }

  static async getAccountsHierarchy() {
    try {
      const result = await query(`
        SELECT 
          id,
          account_code,
          account_name,
          account_type,
          account_subtype,
          normal_balance,
          balance,
          created_at,
          updated_at
        FROM accounts 
        WHERE is_active = true
        ORDER BY 
          CASE account_type
            WHEN 'Asset' THEN 1
            WHEN 'Liability' THEN 2
            WHEN 'Capital' THEN 3
            WHEN 'Revenue' THEN 4
            WHEN 'Expense' THEN 5
            ELSE 6
          END,
          account_subtype,
          account_code
      `);
      
      const formattedRows = result.rows.map(account => ({
        ...account,
        balance: parseFloat(account.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(account.created_at),
        updated_at_formatted: this.formatDateToPakistan(account.updated_at),
        date_created_formatted: this.formatDateOnly(account.created_at)
      }));
      
      const hierarchy = {
        assets: { current: [], nonCurrent: [] },
        liabilities: { current: [], nonCurrent: [] },
        expenses: { operating: [] },
        revenue: [],
        capital: []
      };
      
      formattedRows.forEach(account => {
        switch (account.account_type) {
          case 'Asset':
            if (account.account_subtype === 'Current') {
              hierarchy.assets.current.push(account);
            } else {
              hierarchy.assets.nonCurrent.push(account);
            }
            break;
          case 'Liability':
            if (account.account_subtype === 'Current') {
              hierarchy.liabilities.current.push(account);
            } else {
              hierarchy.liabilities.nonCurrent.push(account);
            }
            break;
          case 'Expense':
            hierarchy.expenses.operating.push(account);
            break;
          case 'Revenue':
            hierarchy.revenue.push(account);
            break;
          case 'Capital':
            hierarchy.capital.push(account);
            break;
        }
      });
      
      return hierarchy;
    } catch (error) {
      console.error('Get accounts hierarchy error:', error);
      throw error;
    }
  }

  static async getAccountById(id) {
    try {
      const result = await query(
        `SELECT * FROM accounts WHERE id = $1 AND is_active = true`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      const formattedRow = {
        ...row,
        balance: parseFloat(row.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        date_created_formatted: this.formatDateOnly(row.created_at)
      };
      
      return formattedRow;
    } catch (error) {
      console.error('Get account by ID error:', error);
      throw error;
    }
  }

  static generateAccountCode(accountType) {
    const prefixes = {
      'Asset': '1000',
      'Liability': '2000',
      'Capital': '3000',
      'Revenue': '4000',
      'Expense': '5000'
    };
    
    return prefixes[accountType] || '6000';
  }

  static async createAccount(accountData) {
    try {
      this.validateAccountData(accountData);
    } catch (validationError) {
      throw validationError;
    }

    const { account_name, account_type, account_subtype, normal_balance } = accountData;
    const baseCode = this.generateAccountCode(account_type);
    
    try {
      const maxCodeResult = await query(
        `SELECT MAX(CAST(account_code AS INTEGER)) as max_code 
         FROM accounts 
         WHERE account_code LIKE $1 
         AND CAST(account_code AS INTEGER) >= $2`,
        [`${baseCode.substring(0, 1)}%`, parseInt(baseCode)]
      );
      
      let nextCode = parseInt(baseCode);
      if (maxCodeResult.rows[0] && maxCodeResult.rows[0].max_code) {
        nextCode = parseInt(maxCodeResult.rows[0].max_code) + 1;
      }
      
      const account_code = nextCode.toString();
      const pakistanTime = this.getPakistanTime();
      
      const insertResult = await query(
        `INSERT INTO accounts 
         (account_code, account_name, account_type, account_subtype, normal_balance, balance, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7) 
         RETURNING id, account_code, account_name, created_at`,
        [account_code, account_name, account_type, account_subtype || null, normal_balance, pakistanTime.timestamp, pakistanTime.timestamp]
      );
      
      return {
        message: 'Account created successfully',
        accountId: insertResult.rows[0].id,
        account_code: insertResult.rows[0].account_code,
        account_name: insertResult.rows[0].account_name,
        created_at: pakistanTime.fullDateTime,
        timestamp: pakistanTime.timestamp
      };
    } catch (error) {
      console.error('Create account error:', error);
      throw error;
    }
  }

  static async updateAccount(accountId, updateData) {
    try {
      this.validateAccountData(updateData);
    } catch (validationError) {
      throw validationError;
    }

    const { account_name, account_type, account_subtype, normal_balance } = updateData;
    
    try {
      const transactionCheck = await query(
        `SELECT COUNT(*) as transaction_count FROM journal_entries WHERE account_id = $1`,
        [accountId]
      );
      
      if (parseInt(transactionCheck.rows[0].transaction_count) > 0) {
        throw new Error('Cannot update account that has transactions');
      }
      
      const pakistanTime = this.getPakistanTime();
      
      const updateResult = await query(
        `UPDATE accounts 
         SET account_name = $1, account_type = $2, account_subtype = $3, normal_balance = $4, updated_at = $5
         WHERE id = $6 AND is_active = true
         RETURNING id`,
        [account_name, account_type, account_subtype || null, normal_balance, pakistanTime.timestamp, accountId]
      );
      
      if (updateResult.rowCount === 0) {
        throw new Error('Account not found or already deleted');
      }
      
      return {
        message: 'Account updated successfully',
        changes: updateResult.rowCount,
        updated_at: pakistanTime.fullDateTime
      };
    } catch (error) {
      console.error('Update account error:', error);
      throw error;
    }
  }

  static async deleteAccount(accountId) {
    try {
      const transactionCheck = await query(
        `SELECT COUNT(*) as transaction_count FROM journal_entries WHERE account_id = $1`,
        [accountId]
      );
      
      if (parseInt(transactionCheck.rows[0].transaction_count) > 0) {
        throw new Error('Cannot delete account that has transactions');
      }
      
      const pakistanTime = this.getPakistanTime();
      
      const deleteResult = await query(
        `UPDATE accounts SET is_active = false, updated_at = $1 WHERE id = $2 AND is_active = true RETURNING id`,
        [pakistanTime.timestamp, accountId]
      );
      
      if (deleteResult.rowCount === 0) {
        throw new Error('Account not found or already deleted');
      }
      
      return {
        message: 'Account deleted successfully',
        changes: deleteResult.rowCount,
        deleted_at: pakistanTime.fullDateTime
      };
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }

  static async getAccountUsage(accountId) {
    try {
      const result = await query(
        `SELECT COUNT(*) as transaction_count FROM journal_entries WHERE account_id = $1`,
        [accountId]
      );
      
      return {
        transaction_count: parseInt(result.rows[0].transaction_count) || 0
      };
    } catch (error) {
      console.error('Get account usage error:', error);
      throw error;
    }
  }

  static async getAccountsByType(accountType) {
    try {
      const result = await query(
        `SELECT * FROM accounts WHERE account_type = $1 AND is_active = true ORDER BY account_code`,
        [accountType]
      );
      
      const formattedRows = result.rows.map(account => ({
        ...account,
        balance: parseFloat(account.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(account.created_at),
        updated_at_formatted: this.formatDateToPakistan(account.updated_at),
        date_created_formatted: this.formatDateOnly(account.created_at)
      }));
      
      return formattedRows;
    } catch (error) {
      console.error('Get accounts by type error:', error);
      throw error;
    }
  }

  static async getChartOfAccounts() {
    try {
      const result = await query(`
        SELECT 
          id,
          account_code,
          account_name,
          account_type,
          account_subtype,
          normal_balance,
          balance,
          is_active
        FROM accounts 
        WHERE is_active = true
        ORDER BY account_type, account_code
      `);
      
      return result.rows.map(account => ({
        ...account,
        balance: parseFloat(account.balance) || 0
      }));
    } catch (error) {
      console.error('Get chart of accounts error:', error);
      throw error;
    }
  }

  // ===== TRANSACTION MANAGEMENT =====

  static validateTransaction(transactionData) {
    const { date, description, entries } = transactionData;
    
    if (!date || date.trim() === '') {
      throw new Error('Transaction date is required');
    }
    
    const dbDate = this.convertToYYYYMMDD(date);
    if (!dbDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    if (!description || description.trim() === '') {
      throw new Error('Transaction description is required');
    }
    
    if (description.length > 200) {
      throw new Error('Description must be less than 200 characters');
    }
    
    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      throw new Error('Transaction must have at least two journal entries (double-entry)');
    }
    
    let totalDebits = 0;
    let totalCredits = 0;
    const accountIds = new Set();
    
    entries.forEach((entry, index) => {
      if (!entry.account_id) {
        throw new Error(`Entry ${index + 1}: Account ID is required`);
      }
      
      if (!entry.amount && entry.amount !== 0) {
        throw new Error(`Entry ${index + 1}: Amount is required`);
      }
      
      const amount = parseFloat(entry.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error(`Entry ${index + 1}: Amount must be a positive number`);
      }
      
      if (!entry.entry_type || !['Debit', 'Credit'].includes(entry.entry_type)) {
        throw new Error(`Entry ${index + 1}: Entry type must be Debit or Credit`);
      }
      
      if (entry.entry_type === 'Debit') {
        totalDebits += amount;
      } else {
        totalCredits += amount;
      }
      
      accountIds.add(entry.account_id);
    });
    
    const difference = Math.abs(totalDebits - totalCredits);
    if (difference > 0.01) {
      throw new Error(`Debits (${totalDebits.toFixed(2)}) do not equal Credits (${totalCredits.toFixed(2)})`);
    }
    
    if (accountIds.size < 2) {
      throw new Error('Transaction must involve at least two different accounts');
    }
    
    return {
      dbDate: dbDate,
      totalDebits: totalDebits,
      totalCredits: totalCredits
    };
  }

  static async createTransaction(transactionData) {
    let validationResult;
    try {
      validationResult = this.validateTransaction(transactionData);
    } catch (validationError) {
      throw validationError;
    }

    const { date, description, reference, entries } = transactionData;
    const { dbDate } = validationResult;
    
    try {
      const { transaction } = require('../database/db');
      
      const result = await transaction(async (client) => {
        const pakistanTime = this.getPakistanTime();
        
        const tidResult = await client.query(
          `SELECT COALESCE(MAX(transaction_number), 0) + 1 as nextTID FROM transactions`
        );
        
        const nextTransactionNumber = parseInt(tidResult.rows[0].nexttid);
        
        const transactionResult = await client.query(
          `INSERT INTO transactions 
           (transaction_date, description, reference, transaction_number, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING id, transaction_number`,
          [dbDate, description, reference || '', nextTransactionNumber, pakistanTime.timestamp, pakistanTime.timestamp]
        );
        
        const transactionId = transactionResult.rows[0].id;
        
        if (!entries || entries.length === 0) {
          throw new Error('No journal entries provided');
        }
        
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          
          await client.query(
            `INSERT INTO journal_entries (transaction_id, account_id, amount, entry_type, created_at) 
             VALUES ($1, $2, $3, $4, $5)`,
            [transactionId, entry.account_id, entry.amount, entry.entry_type, pakistanTime.timestamp]
          );
          
          await this._updateAccountBalanceInternal(client, entry.account_id, entry.amount, entry.entry_type, pakistanTime.timestamp);
        }
        
        return {
          transactionId: transactionId,
          transactionNumber: nextTransactionNumber,
          message: `Transaction TID-${nextTransactionNumber} recorded successfully`,
          totalDebits: validationResult.totalDebits,
          totalCredits: validationResult.totalCredits,
          created_at: pakistanTime.fullDateTime,
          date_display: this.convertToDDMMYYYY(dbDate)
        };
      });
      
      return result;
    } catch (error) {
      console.error('Create transaction error:', error);
      throw error;
    }
  }

  static async _updateAccountBalanceInternal(client, accountId, amount, entryType, timestamp) {
    const accountResult = await client.query(
      `SELECT normal_balance FROM accounts WHERE id = $1`,
      [accountId]
    );
    
    if (accountResult.rows.length === 0) {
      throw new Error('Account not found');
    }
    
    const account = accountResult.rows[0];
    const numericAmount = parseFloat(amount);
    let balanceChange = 0;
    
    if (account.normal_balance === 'Debit') {
      balanceChange = entryType === 'Debit' ? numericAmount : -numericAmount;
    } else {
      balanceChange = entryType === 'Credit' ? numericAmount : -numericAmount;
    }
    
    await client.query(
      `UPDATE accounts SET balance = balance + $1, updated_at = $2 WHERE id = $3`,
      [balanceChange, timestamp, accountId]
    );
  }

  static async getAllTransactions() {
    try {
      const result = await query(`
        SELECT 
          t.id as transaction_id,
          t.transaction_number,
          TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
          t.description,
          t.reference,
          t.created_at,
          t.updated_at,
          je.id as journal_entry_id,
          je.account_id,
          je.amount,
          je.entry_type,
          je.created_at as journal_created_at,
          a.account_name,
          a.account_code,
          a.normal_balance
        FROM transactions t
        JOIN journal_entries je ON t.id = je.transaction_id
        JOIN accounts a ON je.account_id = a.id
        ORDER BY t.transaction_date DESC, t.id DESC, je.entry_type DESC
      `);
      
      const formattedRows = result.rows.map(row => ({
        transaction_id: row.transaction_id,
        transaction_number: row.transaction_number,
        transaction_date: row.transaction_date, // Now string 'YYYY-MM-DD'
        description: row.description,
        reference: row.reference,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        id: row.journal_entry_id,
        account_id: row.account_id,
        account_name: row.account_name,
        account_code: row.account_code,
        amount: parseFloat(row.amount),
        entry_type: row.entry_type,
        journal_created_at: row.journal_created_at,
        normal_balance: row.normal_balance
      }));
      
      return formattedRows;
    } catch (error) {
      console.error('Get all transactions error:', error);
      throw error;
    }
  }

  static async getTransactionById(transactionId) {
    try {
      const result = await query(`
        SELECT 
          t.id,
          t.transaction_number,
          TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
          t.description,
          t.reference,
          t.created_at,
          t.updated_at,
          je.id as entry_id,
          je.account_id,
          je.amount,
          je.entry_type,
          a.account_name,
          a.account_code,
          a.normal_balance
        FROM transactions t
        JOIN journal_entries je ON t.id = je.transaction_id
        JOIN accounts a ON je.account_id = a.id
        WHERE t.id = $1
        ORDER BY je.entry_type DESC, je.amount DESC
      `, [transactionId]);
      
      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }
      
      const transaction = {
        id: result.rows[0].id,
        transaction_number: result.rows[0].transaction_number,
        transaction_date: result.rows[0].transaction_date, // Now string 'YYYY-MM-DD'
        transaction_date_formatted: this.convertToDDMMYYYY(result.rows[0].transaction_date),
        description: result.rows[0].description,
        reference: result.rows[0].reference,
        created_at: result.rows[0].created_at,
        created_at_formatted: this.formatDateToPakistan(result.rows[0].created_at),
        updated_at: result.rows[0].updated_at,
        updated_at_formatted: this.formatDateToPakistan(result.rows[0].updated_at),
        entries: []
      };
      
      let totalDebits = 0;
      let totalCredits = 0;
      
      result.rows.forEach(row => {
        transaction.entries.push({
          id: row.entry_id,
          account_id: row.account_id,
          account_name: row.account_name,
          account_code: row.account_code,
          amount: parseFloat(row.amount),
          entry_type: row.entry_type,
          normal_balance: row.normal_balance
        });
        
        if (row.entry_type === 'Debit') {
          totalDebits += parseFloat(row.amount);
        } else {
          totalCredits += parseFloat(row.amount);
        }
      });
      
      transaction.totalDebits = totalDebits;
      transaction.totalCredits = totalCredits;
      transaction.isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
      
      return transaction;
    } catch (error) {
      console.error('Get transaction by ID error:', error);
      throw error;
    }
  }

  static async updateTransaction(transactionId, updateData) {
    const isFullUpdate = updateData.entries && Array.isArray(updateData.entries);
    
    if (isFullUpdate) {
      return await this._updateFullTransaction(transactionId, updateData);
    } else {
      const { date, description, reference } = updateData;
      
      if (!date || !description) {
        throw new Error('Transaction date and description are required');
      }
      
      const sqlDate = this.convertToYYYYMMDD(date);
      if (!sqlDate) {
        throw new Error('Invalid date format. Use dd/mm/yyyy');
      }
      
      const pakistanTime = this.getPakistanTime();
      
      try {
        const result = await query(
          `UPDATE transactions SET transaction_date = $1, description = $2, reference = $3, updated_at = $4 WHERE id = $5 RETURNING id`,
          [sqlDate, description, reference, pakistanTime.timestamp, transactionId]
        );
        
        if (result.rowCount === 0) {
          throw new Error('Transaction not found');
        }
        
        return {
          message: 'Transaction updated successfully',
          changes: result.rowCount,
          updated_at: pakistanTime.fullDateTime
        };
      } catch (error) {
        console.error('Update transaction error:', error);
        throw error;
      }
    }
  }

  static async _updateFullTransaction(transactionId, updateData) {
    const { date, description, reference, entries } = updateData;
    
    if (!date || !description || !entries || !Array.isArray(entries)) {
      throw new Error('Date, description, and journal entries are required for full update');
    }
    
    const sqlDate = this.convertToYYYYMMDD(date);
    if (!sqlDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    this.validateTransaction({ date, description, entries });
    
    try {
      const { transaction } = require('../database/db');
      
      const result = await transaction(async (client) => {
        const oldEntriesResult = await client.query(
          'SELECT * FROM journal_entries WHERE transaction_id = $1',
          [transactionId]
        );
        
        if (oldEntriesResult.rows.length === 0) {
          throw new Error('No existing transaction found');
        }
        
        const pakistanTime = this.getPakistanTime();
        
        for (const oldEntry of oldEntriesResult.rows) {
          const reverseEntryType = oldEntry.entry_type === 'Debit' ? 'Credit' : 'Debit';
          await this._updateAccountBalanceInternal(client, oldEntry.account_id, oldEntry.amount, reverseEntryType, pakistanTime.timestamp);
        }
        
        await client.query('DELETE FROM journal_entries WHERE transaction_id = $1', [transactionId]);
        
        const updateResult = await client.query(
          `UPDATE transactions 
           SET transaction_date = $1, description = $2, reference = $3, updated_at = $4 
           WHERE id = $5 
           RETURNING transaction_number`,
          [sqlDate, description, reference || '', pakistanTime.timestamp, transactionId]
        );
        
        if (updateResult.rowCount === 0) {
          throw new Error('Transaction not found');
        }
        
        for (const entry of entries) {
          await client.query(
            `INSERT INTO journal_entries (transaction_id, account_id, amount, entry_type, created_at) 
             VALUES ($1, $2, $3, $4, $5)`,
            [transactionId, entry.account_id, entry.amount, entry.entry_type, pakistanTime.timestamp]
          );
          
          await this._updateAccountBalanceInternal(client, entry.account_id, entry.amount, entry.entry_type, pakistanTime.timestamp);
        }
        
        const totalDebits = entries
          .filter(e => e.entry_type === 'Debit')
          .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        const totalCredits = entries
          .filter(e => e.entry_type === 'Credit')
          .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        return {
          message: 'Transaction fully updated successfully',
          transactionId: transactionId,
          transactionNumber: updateResult.rows[0].transaction_number,
          totalDebits: totalDebits,
          totalCredits: totalCredits,
          updated_at: pakistanTime.fullDateTime,
          entries_updated: entries.length,
          old_entries_reversed: oldEntriesResult.rows.length
        };
      });
      
      return result;
    } catch (error) {
      console.error('Update full transaction error:', error);
      throw error;
    }
  }

  static async deleteTransaction(transactionId) {
    try {
      const { transaction } = require('../database/db');
      
      const result = await transaction(async (client) => {
        const entriesResult = await client.query(
          'SELECT * FROM journal_entries WHERE transaction_id = $1',
          [transactionId]
        );
        
        if (entriesResult.rows.length === 0) {
          throw new Error('Transaction not found');
        }
        
        const pakistanTime = this.getPakistanTime();
        
        for (const entry of entriesResult.rows) {
          const reverseEntryType = entry.entry_type === 'Debit' ? 'Credit' : 'Debit';
          await this._updateAccountBalanceInternal(client, entry.account_id, entry.amount, reverseEntryType, pakistanTime.timestamp);
        }
        
        await client.query('DELETE FROM journal_entries WHERE transaction_id = $1', [transactionId]);
        
        await client.query('DELETE FROM transactions WHERE id = $1', [transactionId]);
        
        return {
          message: 'Transaction deleted successfully',
          entries_reversed: entriesResult.rows.length,
          deleted_at: pakistanTime.fullDateTime
        };
      });
      
      return result;
    } catch (error) {
      console.error('Delete transaction error:', error);
      throw error;
    }
  }

  static async getNextTransactionNumber() {
    try {
      const result = await query(
        'SELECT COALESCE(MAX(transaction_number), 0) + 1 as nextTID FROM transactions'
      );
      
      return { nextTID: parseInt(result.rows[0].nexttid) };
    } catch (error) {
      console.error('Get next transaction number error:', error);
      throw error;
    }
  }

  static async getTransactionsByDateRange(startDate, endDate) {
    const dbStartDate = this.convertToYYYYMMDD(startDate);
    const dbEndDate = this.convertToYYYYMMDD(endDate);
    
    if (!dbStartDate || !dbEndDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    try {
      const result = await query(`
        SELECT 
          t.id,
          t.transaction_number,
          TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
          t.description,
          t.reference,
          t.created_at,
          t.updated_at,
          STRING_AGG(
            a.account_name || ' (' || 
            CASE je.entry_type 
              WHEN 'Debit' THEN 'Dr: ' 
              WHEN 'Credit' THEN 'Cr: ' 
            END || je.amount || ')', 
            ', '
          ) as entry_summary
        FROM transactions t
        JOIN journal_entries je ON t.id = je.transaction_id
        JOIN accounts a ON je.account_id = a.id
        WHERE t.transaction_date BETWEEN $1 AND $2
        GROUP BY t.id, t.transaction_number, t.transaction_date, t.description, t.reference, t.created_at, t.updated_at
        ORDER BY t.transaction_date DESC, t.id DESC
      `, [dbStartDate, dbEndDate]);
      
      const formattedRows = result.rows.map(row => ({
        id: row.id,
        transaction_number: row.transaction_number,
        transaction_date: row.transaction_date,
        transaction_date_formatted: this.convertToDDMMYYYY(row.transaction_date),
        description: row.description,
        reference: row.reference,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        entry_summary: row.entry_summary
      }));
      
      return formattedRows;
    } catch (error) {
      console.error('Get transactions by date range error:', error);
      throw error;
    }
  }

  static async getTransactionsByDate(date) {
    const dbDate = this.convertToYYYYMMDD(date);
    
    if (!dbDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    try {
      const result = await query(`
        SELECT 
          t.id,
          t.transaction_number,
          TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
          t.description,
          t.reference,
          t.created_at,
          t.updated_at,
          STRING_AGG(
            a.account_name || ' (' || 
            CASE je.entry_type 
              WHEN 'Debit' THEN 'Dr: ' 
              WHEN 'Credit' THEN 'Cr: ' 
            END || je.amount || ')', 
            ', '
          ) as entry_summary
        FROM transactions t
        JOIN journal_entries je ON t.id = je.transaction_id
        JOIN accounts a ON je.account_id = a.id
        WHERE t.transaction_date = $1
        GROUP BY t.id, t.transaction_number, t.transaction_date, t.description, t.reference, t.created_at, t.updated_at
        ORDER BY t.id DESC
      `, [dbDate]);
      
      const formattedRows = result.rows.map(row => ({
        id: row.id,
        transaction_number: row.transaction_number,
        transaction_date: row.transaction_date,
        transaction_date_formatted: this.convertToDDMMYYYY(row.transaction_date),
        description: row.description,
        reference: row.reference,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        entry_summary: row.entry_summary
      }));
      
      return formattedRows;
    } catch (error) {
      console.error('Get transactions by date error:', error);
      throw error;
    }
  }

  static async searchTransactions(searchTerm) {
    try {
      const result = await query(`
        SELECT DISTINCT 
          t.id,
          t.transaction_number,
          TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
          t.description,
          t.reference,
          t.created_at,
          t.updated_at,
          STRING_AGG(
            a.account_name || ' (' || 
            CASE je.entry_type 
              WHEN 'Debit' THEN 'Dr: ' 
              WHEN 'Credit' THEN 'Cr: ' 
            END || je.amount || ')', 
            ', '
          ) as entry_summary
        FROM transactions t
        LEFT JOIN journal_entries je ON t.id = je.transaction_id
        LEFT JOIN accounts a ON je.account_id = a.id
        WHERE t.description LIKE $1 
           OR t.reference LIKE $2
           OR a.account_name LIKE $3
           OR t.transaction_number::TEXT LIKE $4
           OR t.id::TEXT LIKE $5
        GROUP BY t.id, t.transaction_number, t.transaction_date, t.description, t.reference, t.created_at, t.updated_at
        ORDER BY t.transaction_date DESC
        LIMIT 50
      `, 
      [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
      
      const formattedRows = result.rows.map(row => ({
        id: row.id,
        transaction_number: row.transaction_number,
        transaction_date: row.transaction_date,
        transaction_date_formatted: this.convertToDDMMYYYY(row.transaction_date),
        description: row.description,
        reference: row.reference,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        entry_summary: row.entry_summary
      }));
      
      return formattedRows;
    } catch (error) {
      console.error('Search transactions error:', error);
      throw error;
    }
  }

  // ===== FINANCIAL REPORTS =====

  static async getBalanceSheet() {
    try {
      const result = await query(`
        SELECT 
          account_type,
          account_subtype,
          account_name,
          account_code,
          balance,
          normal_balance,
          created_at,
          updated_at
        FROM accounts 
        WHERE account_type IN ('Asset', 'Liability', 'Capital') 
        AND is_active = true
        ORDER BY account_type, account_code
      `);
      
      const formattedRows = result.rows.map(account => ({
        ...account,
        balance: parseFloat(account.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(account.created_at),
        updated_at_formatted: this.formatDateToPakistan(account.updated_at),
        date_created_formatted: this.formatDateOnly(account.created_at)
      }));
      
      const assets = formattedRows.filter(item => item.account_type === 'Asset');
      const liabilities = formattedRows.filter(item => item.account_type === 'Liability');
      const capital = formattedRows.filter(item => item.account_type === 'Capital');
      
      const totalAssets = assets.reduce((sum, item) => sum + (item.balance || 0), 0);
      const totalLiabilities = liabilities.reduce((sum, item) => sum + (item.balance || 0), 0);
      const totalCapital = capital.reduce((sum, item) => {
        const balance = item.balance || 0;
        if (item.normal_balance === 'Debit') {
          return sum - balance;
        }
        return sum + balance;
      }, 0);
      
      return {
        assets: assets,
        liabilities: liabilities,
        capital: capital,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        totalCapital: totalCapital
      };
    } catch (error) {
      console.error('Get balance sheet error:', error);
      throw error;
    }
  }

  static async getBalanceSheetForPeriod(startDate, endDate) {
    const dbStartDate = this.convertToYYYYMMDD(startDate);
    const dbEndDate = this.convertToYYYYMMDD(endDate);
    
    if (!dbStartDate || !dbEndDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    try {
      const result = await query(`
        SELECT 
          a.account_type,
          a.account_subtype,
          a.account_name,
          a.account_code,
          a.created_at,
          a.updated_at,
          COALESCE(SUM(
            CASE 
              WHEN a.normal_balance = 'Debit' AND je.entry_type = 'Debit' THEN je.amount
              WHEN a.normal_balance = 'Debit' AND je.entry_type = 'Credit' THEN -je.amount
              WHEN a.normal_balance = 'Credit' AND je.entry_type = 'Credit' THEN je.amount
              WHEN a.normal_balance = 'Credit' AND je.entry_type = 'Debit' THEN -je.amount
              ELSE 0
            END
          ), 0) as period_balance
        FROM accounts a
        LEFT JOIN journal_entries je ON a.id = je.account_id
        LEFT JOIN transactions t ON je.transaction_id = t.id
        WHERE a.account_type IN ('Asset', 'Liability', 'Capital')
        AND a.is_active = true
        AND (t.transaction_date IS NULL OR t.transaction_date BETWEEN $1 AND $2)
        GROUP BY a.id, a.account_type, a.account_name, a.account_code, a.created_at, a.updated_at
        ORDER BY a.account_type, a.account_code
      `, [dbStartDate, dbEndDate]);
      
      const formattedRows = result.rows.map(row => ({
        ...row,
        period_balance: parseFloat(row.period_balance) || 0,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        date_created_formatted: this.formatDateOnly(row.created_at)
      }));
      
      const assets = formattedRows.filter(item => item.account_type === 'Asset');
      const liabilities = formattedRows.filter(item => item.account_type === 'Liability');
      const capital = formattedRows.filter(item => item.account_type === 'Capital');
      
      const totalAssets = assets.reduce((sum, item) => sum + (item.period_balance || 0), 0);
      const totalLiabilities = liabilities.reduce((sum, item) => sum + (item.period_balance || 0), 0);
      const totalCapital = capital.reduce((sum, item) => {
        const balance = item.period_balance || 0;
        if (item.normal_balance === 'Debit') {
          return sum - balance;
        }
        return sum + balance;
      }, 0);
      
      return {
        assets: assets,
        liabilities: liabilities,
        capital: capital,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        totalCapital: totalCapital,
        period: {
          startDate: startDate,
          endDate: endDate
        }
      };
    } catch (error) {
      console.error('Get balance sheet for period error:', error);
      throw error;
    }
  }

  static async getIncomeStatement() {
    try {
      const result = await query(`
        SELECT 
          account_type,
          account_name,
          account_code,
          balance,
          created_at,
          updated_at
        FROM accounts 
        WHERE account_type IN ('Revenue', 'Expense') 
        AND is_active = true
        ORDER BY account_type, account_code
      `);
      
      const formattedRows = result.rows.map(account => ({
        ...account,
        balance: parseFloat(account.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(account.created_at),
        updated_at_formatted: this.formatDateToPakistan(account.updated_at),
        date_created_formatted: this.formatDateOnly(account.created_at)
      }));
      
      const revenue = formattedRows.filter(item => item.account_type === 'Revenue');
      const expenses = formattedRows.filter(item => item.account_type === 'Expense');
      
      const totalRevenue = revenue.reduce((sum, item) => sum + (item.balance || 0), 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + (item.balance || 0), 0);
      const netIncome = totalRevenue - totalExpenses;
      
      const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100) : 0;
      const expenseRatio = totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100) : 0;
      
      return {
        revenue: revenue,
        expenses: expenses,
        totalRevenue: totalRevenue,
        totalExpenses: totalExpenses,
        netIncome: netIncome,
        ratios: {
          profitMargin: profitMargin.toFixed(2),
          expenseRatio: expenseRatio.toFixed(2)
        }
      };
    } catch (error) {
      console.error('Get income statement error:', error);
      throw error;
    }
  }

  static async getIncomeStatementForPeriod(startDate, endDate) {
    const dbStartDate = this.convertToYYYYMMDD(startDate);
    const dbEndDate = this.convertToYYYYMMDD(endDate);
    
    if (!dbStartDate || !dbEndDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    try {
      const result = await query(`
        SELECT 
          a.account_type,
          a.account_name,
          a.account_code,
          a.created_at,
          a.updated_at,
          COALESCE(SUM(
            CASE 
              WHEN a.normal_balance = 'Debit' AND je.entry_type = 'Debit' THEN je.amount
              WHEN a.normal_balance = 'Debit' AND je.entry_type = 'Credit' THEN -je.amount
              WHEN a.normal_balance = 'Credit' AND je.entry_type = 'Credit' THEN je.amount
              WHEN a.normal_balance = 'Credit' AND je.entry_type = 'Debit' THEN -je.amount
              ELSE 0
            END
          ), 0) as period_balance
        FROM accounts a
        LEFT JOIN journal_entries je ON a.id = je.account_id
        LEFT JOIN transactions t ON je.transaction_id = t.id
        WHERE a.account_type IN ('Revenue', 'Expense')
        AND a.is_active = true
        AND (t.transaction_date IS NULL OR t.transaction_date BETWEEN $1 AND $2)
        GROUP BY a.id, a.account_type, a.account_name, a.account_code, a.created_at, a.updated_at
        ORDER BY a.account_type, a.account_code
      `, [dbStartDate, dbEndDate]);
      
      const formattedRows = result.rows.map(row => ({
        ...row,
        period_balance: parseFloat(row.period_balance) || 0,
        created_at_formatted: this.formatDateToPakistan(row.created_at),
        updated_at_formatted: this.formatDateToPakistan(row.updated_at),
        date_created_formatted: this.formatDateOnly(row.created_at)
      }));
      
      const revenue = formattedRows.filter(item => item.account_type === 'Revenue');
      const expenses = formattedRows.filter(item => item.account_type === 'Expense');
      
      const totalRevenue = revenue.reduce((sum, item) => sum + (item.period_balance || 0), 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + (item.period_balance || 0), 0);
      const netIncome = totalRevenue - totalExpenses;
      
      const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100) : 0;
      const expenseRatio = totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100) : 0;
      
      return {
        revenue: revenue,
        expenses: expenses,
        totalRevenue: totalRevenue,
        totalExpenses: totalExpenses,
        netIncome: netIncome,
        ratios: {
          profitMargin: profitMargin.toFixed(2),
          expenseRatio: expenseRatio.toFixed(2)
        },
        period: {
          startDate: startDate,
          endDate: endDate
        }
      };
    } catch (error) {
      console.error('Get income statement for period error:', error);
      throw error;
    }
  }

  // ===== LEDGER METHODS (FIXED) =====

  static async getAccountLedger(accountId, startDate, endDate) {
    const dbStartDate = this.convertToYYYYMMDD(startDate);
    const dbEndDate = this.convertToYYYYMMDD(endDate);
    
    if (!dbStartDate || !dbEndDate) {
      throw new Error('Invalid date format. Use dd/mm/yyyy');
    }
    
    try {
      const accountResult = await query(
        `SELECT * FROM accounts WHERE id = $1 AND is_active = true`,
        [accountId]
      );
      
      if (accountResult.rows.length === 0) {
        throw new Error('Account not found or inactive');
      }
      
      const account = accountResult.rows[0];
      const formattedAccount = {
        ...account,
        balance: parseFloat(account.balance) || 0,
        created_at_formatted: this.formatDateToPakistan(account.created_at),
        updated_at_formatted: this.formatDateToPakistan(account.updated_at),
        date_created_formatted: this.formatDateOnly(account.created_at)
      };
      
      const openingBalanceResult = await query(
        `SELECT COALESCE(SUM(
          CASE 
            WHEN $1 = 'Debit' AND je.entry_type = 'Debit' THEN je.amount
            WHEN $1 = 'Debit' AND je.entry_type = 'Credit' THEN -je.amount
            WHEN $1 = 'Credit' AND je.entry_type = 'Credit' THEN je.amount
            WHEN $1 = 'Credit' AND je.entry_type = 'Debit' THEN -je.amount
            ELSE 0
          END
        ), 0) as opening_balance
        FROM journal_entries je
        JOIN transactions t ON je.transaction_id = t.id
        WHERE je.account_id = $2
        AND t.transaction_date < $3`,
        [account.normal_balance, accountId, dbStartDate]
      );
      
      const openingBalance = parseFloat(openingBalanceResult.rows[0]?.opening_balance || 0);
      
      const transactionsResult = await query(
        `SELECT 
          t.id as transaction_id,
          t.transaction_number,
          TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
          t.description,
          t.reference,
          je.amount,
          je.entry_type,
          je.created_at,
          (
            SELECT STRING_AGG(DISTINCT oa.account_name || ' (' || oje.entry_type || ')', ', ')
            FROM journal_entries oje
            JOIN accounts oa ON oje.account_id = oa.id
            WHERE oje.transaction_id = t.id 
            AND oje.account_id != $1
          ) as other_accounts
        FROM transactions t
        JOIN journal_entries je ON t.id = je.transaction_id
        WHERE je.account_id = $2
        AND t.transaction_date BETWEEN $3 AND $4
        ORDER BY t.transaction_date, t.id`,
        [accountId, accountId, dbStartDate, dbEndDate]
      );
      
      let runningBalance = openingBalance;
      const ledgerEntries = [];
      
      transactionsResult.rows.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        let balanceEffect = 0;
        
        if (account.normal_balance === 'Debit') {
          balanceEffect = transaction.entry_type === 'Debit' ? amount : -amount;
        } else {
          balanceEffect = transaction.entry_type === 'Credit' ? amount : -amount;
        }
        
        runningBalance += balanceEffect;
        
        ledgerEntries.push({
          transaction_id: transaction.transaction_id,
          transaction_number: transaction.transaction_number,
          date: transaction.transaction_date, // Now string 'YYYY-MM-DD'
          date_formatted: this.convertToDDMMYYYY(transaction.transaction_date),
          description: transaction.description,
          reference: transaction.reference || '',
          entry_type: transaction.entry_type,
          amount: amount,
          balance_effect: balanceEffect,
          running_balance: runningBalance,
          other_accounts: transaction.other_accounts || 'Various',
          created_at: this.formatDateToPakistan(transaction.created_at)
        });
      });
      
      const closingBalance = runningBalance;
      
      return {
        account: formattedAccount,
        period: {
          startDate: startDate,
          endDate: endDate,
          startDate_db: dbStartDate,
          endDate_db: dbEndDate
        },
        openingBalance: openingBalance,
        closingBalance: closingBalance,
        transactions: ledgerEntries,
        summary: {
          total_debits: ledgerEntries.filter(e => e.entry_type === 'Debit').reduce((sum, e) => sum + e.amount, 0),
          total_credits: ledgerEntries.filter(e => e.entry_type === 'Credit').reduce((sum, e) => sum + e.amount, 0),
          transaction_count: ledgerEntries.length
        }
      };
    } catch (error) {
      console.error('Get account ledger error:', error);
      throw error;
    }
  }

  // ===== SYSTEM HEALTH & VALIDATION =====

  static async validateAccountingEquation() {
    try {
      const result = await query(`
        SELECT 
          SUM(CASE WHEN account_type = 'Asset' THEN balance ELSE 0 END) as total_assets,
          SUM(CASE WHEN account_type = 'Liability' THEN balance ELSE 0 END) as total_liabilities,
          SUM(CASE 
            WHEN account_type = 'Capital' AND normal_balance = 'Credit' THEN balance
            WHEN account_type = 'Capital' AND normal_balance = 'Debit' THEN -balance
            ELSE 0 
          END) as total_capital,
          COUNT(*) as total_accounts
        FROM accounts 
        WHERE is_active = true
      `);
      
      const totalAssets = parseFloat(result.rows[0].total_assets || 0);
      const totalLiabilities = parseFloat(result.rows[0].total_liabilities || 0);
      const totalCapital = parseFloat(result.rows[0].total_capital || 0);
      const difference = Math.abs(totalAssets - (totalLiabilities + totalCapital));
      const equationHolds = difference < 0.01;
      
      const pakistanTime = this.getPakistanTime();
      
      return {
        equationHolds: equationHolds,
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        totalCapital: totalCapital.toFixed(2),
        totalEquity: (totalLiabilities + totalCapital).toFixed(2),
        difference: difference.toFixed(2),
        validated_at: pakistanTime.fullDateTime,
        total_accounts: result.rows[0].total_accounts || 0
      };
    } catch (error) {
      console.error('Validate accounting equation error:', error);
      throw error;
    }
  }

  static async getFinancialRatios() {
    try {
      const result = await query(`
        SELECT 
          SUM(CASE WHEN account_type = 'Asset' THEN balance ELSE 0 END) as total_assets,
          SUM(CASE WHEN account_type = 'Liability' THEN balance ELSE 0 END) as total_liabilities,
          SUM(CASE WHEN account_type = 'Capital' THEN balance ELSE 0 END) as total_capital,
          SUM(CASE WHEN account_type = 'Revenue' THEN balance ELSE 0 END) as total_revenue,
          SUM(CASE WHEN account_type = 'Expense' THEN balance ELSE 0 END) as total_expenses
        FROM accounts 
        WHERE is_active = true
      `);
      
      const totalAssets = parseFloat(result.rows[0].total_assets || 0);
      const totalLiabilities = parseFloat(result.rows[0].total_liabilities || 0);
      const totalCapital = parseFloat(result.rows[0].total_capital || 0);
      const totalRevenue = parseFloat(result.rows[0].total_revenue || 0);
      const totalExpenses = parseFloat(result.rows[0].total_expenses || 0);
      const netIncome = totalRevenue - totalExpenses;
      
      const ratios = {
        debtRatio: totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(2) : 0,
        equityRatio: totalAssets > 0 ? ((totalCapital / totalAssets) * 100).toFixed(2) : 0,
        profitMargin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : 0,
        currentRatio: totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : 0,
        returnOnAssets: totalAssets > 0 ? ((netIncome / totalAssets) * 100).toFixed(2) : 0,
        rawData: {
          totalAssets,
          totalLiabilities,
          totalCapital,
          totalRevenue,
          totalExpenses,
          netIncome
        }
      };
      
      return ratios;
    } catch (error) {
      console.error('Get financial ratios error:', error);
      throw error;
    }
  }

  static async getSystemStats() {
    try {
      const stats = {};
      const pakistanTime = this.getPakistanTime();
      stats.report_generated_at = pakistanTime.fullDateTime;
      
      const [
        accountsResult,
        transactionsResult,
        journalEntriesResult,
        latestDateResult
      ] = await Promise.all([
        query('SELECT COUNT(*) as count FROM accounts WHERE is_active = true'),
        query('SELECT COUNT(*) as count FROM transactions'),
        query('SELECT COUNT(*) as count FROM journal_entries'),
        query('SELECT MAX(transaction_date) as latestDate, MAX(created_at) as latestCreated FROM transactions')
      ]);
      
      stats.activeAccounts = parseInt(accountsResult.rows[0].count);
      stats.totalTransactions = parseInt(transactionsResult.rows[0].count);
      stats.journalEntries = parseInt(journalEntriesResult.rows[0].count);
      stats.latestTransactionDate = latestDateResult.rows[0].latestdate ? 
        this.convertToDDMMYYYY(latestDateResult.rows[0].latestdate) : null;
      stats.latestTransactionCreated = latestDateResult.rows[0].latestcreated ? 
        this.formatDateToPakistan(latestDateResult.rows[0].latestcreated) : null;
      
      return stats;
    } catch (error) {
      console.error('Get system stats error:', error);
      throw error;
    }
  }

  // ===== DEBUG METHODS =====

  static async debugSystem() {
    try {
      const debugInfo = {
        time: this.getPakistanTime(),
        tables: {},
        issues: []
      };
      
      const tables = ['accounts', 'transactions', 'journal_entries', 'users'];
      
      for (const table of tables) {
        try {
          const result = await query(
            `SELECT column_name, data_type, is_nullable 
             FROM information_schema.columns 
             WHERE table_name = $1 
             ORDER BY ordinal_position`,
            [table]
          );
          debugInfo.tables[table] = result.rows;
        } catch (error) {
          debugInfo.tables[table] = `Error: ${error.message}`;
        }
      }
      
      try {
        const orphanedResult = await query(
          `SELECT COUNT(*) as count FROM journal_entries je 
           LEFT JOIN transactions t ON je.transaction_id = t.id 
           WHERE t.id IS NULL`
        );
        if (parseInt(orphanedResult.rows[0].count) > 0) {
          debugInfo.issues.push(`Found ${orphanedResult.rows[0].count} orphaned journal entries`);
        }
      } catch (error) {
        debugInfo.issues.push(`Error checking orphaned entries: ${error.message}`);
      }
      
      try {
        const invalidBalanceResult = await query(
          `SELECT COUNT(*) as count FROM accounts WHERE normal_balance NOT IN ('Debit', 'Credit')`
        );
        if (parseInt(invalidBalanceResult.rows[0].count) > 0) {
          debugInfo.issues.push(`Found ${invalidBalanceResult.rows[0].count} accounts with invalid normal balance`);
        }
      } catch (error) {
        debugInfo.issues.push(`Error checking normal balances: ${error.message}`);
      }
      
      return debugInfo;
    } catch (error) {
      console.error('Debug system error:', error);
      throw error;
    }
  }
}

module.exports = AccountingModel;