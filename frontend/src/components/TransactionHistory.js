import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatCurrency } from '../utils/currencyFormatter';
import { formatKarachiTime, formatTimestamp } from '../utils/timeFormatter';
import AuthService from '../utils/auth'; // ADD THIS IMPORT

// Helper function to convert yyyy-mm-dd to dd/mm/yyyy for display
const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const TransactionHistory = ({ refreshKey }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [searchTID, setSearchTID] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [isFullEditMode, setIsFullEditMode] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // ADD THIS: Get user role
  const isAdmin = AuthService.isAdmin();
  const userRole = AuthService.getRole();

  useEffect(() => {
    loadTransactions();
    loadAccounts();
  }, [refreshKey]);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const response = await accountingAPI.getAccounts();
      setAccounts(response.data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      alert('Error loading accounts: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await accountingAPI.getTransactions();
      
      if (!response.data || response.data.length === 0) {
        setTransactions([]);
        return;
      }

      const grouped = {};
      
      response.data.forEach(entry => {
        const transactionId = entry.transaction_id;
        
        if (!grouped[transactionId]) {
          grouped[transactionId] = {
            id: transactionId,
            transaction_number: entry.transaction_number,
            date: entry.transaction_date,
            description: entry.description,
            reference: entry.reference,
            created_at: entry.created_at,
            created_at_formatted: entry.created_at_formatted || formatKarachiTime(entry.created_at),
            updated_at: entry.updated_at,
            updated_at_formatted: entry.updated_at_formatted || formatKarachiTime(entry.updated_at),
            entries: []
          };
        }
        
        grouped[transactionId].entries.push({
          id: `${transactionId}-${entry.account_id}-${entry.entry_type}`,
          entry_id: entry.id,
          account_id: entry.account_id,
          account_code: entry.account_code,
          account_name: entry.account_name,
          amount: parseFloat(entry.amount),
          entry_type: entry.entry_type
        });
      });
      
      const transactionArray = Object.values(grouped);
      setTransactions(transactionArray);
    } catch (error) {
      console.error('Error loading transactions:', error);
      alert('Error loading transactions: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions based on TID search
  const filteredTransactions = transactions.filter(transaction => 
    !searchTID || 
    transaction.transaction_number?.toString().includes(searchTID) ||
    transaction.id.toString().includes(searchTID)
  );

  const handleDelete = async (transactionId) => {
    // ADD THIS: Prevent deletion for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to delete transactions');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this transaction? This will permanently remove the transaction and update account balances. This action cannot be undone.')) {
      return;
    }

    try {
      await accountingAPI.deleteTransaction(transactionId);
      alert('Transaction deleted successfully!');
      loadTransactions();
    } catch (error) {
      alert('Error deleting transaction: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = async (transaction) => {
    // ADD THIS: Prevent editing for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to edit transactions');
      return;
    }
    
    try {
      const response = await accountingAPI.getTransactionById(transaction.id);
      const fullTransaction = response.data;
      
      setEditingTransaction(transaction.id);
      setIsFullEditMode(false);
      
      setEditFormData({
        date: formatDateForDisplay(fullTransaction.transaction_date),
        description: fullTransaction.description,
        reference: fullTransaction.reference || '',
        entries: fullTransaction.entries.map(entry => ({
          entry_id: entry.id,
          account_id: entry.account_id,
          account_code: entry.account_code,
          account_name: entry.account_name,
          amount: entry.amount.toString(),
          entry_type: entry.entry_type
        }))
      });
      
      setEditErrors({});
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      alert('Error loading transaction details: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditSubmit = async (transactionId) => {
    // ADD THIS: Prevent submission for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to edit transactions');
      return;
    }
    
    const errors = {};
    
    if (!editFormData.date || !editFormData.date.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      errors.date = 'Valid date in dd/mm/yyyy format is required';
    }
    
    if (!editFormData.description || editFormData.description.trim() === '') {
      errors.description = 'Description is required';
    }
    
    if (isFullEditMode) {
      if (!editFormData.entries || editFormData.entries.length < 2) {
        errors.entries = 'Transaction must have at least two entries';
      } else {
        const { debits, credits, balanced } = calculateTransactionTotals(editFormData.entries);
        if (!balanced) {
          errors.balance = `Debits (${debits}) do not equal Credits (${credits})`;
        }
        
        editFormData.entries.forEach((entry, index) => {
          if (!entry.account_id) {
            errors[`entry_${index}_account`] = `Entry ${index + 1}: Account is required`;
          }
          if (!entry.amount || parseFloat(entry.amount) <= 0) {
            errors[`entry_${index}_amount`] = `Entry ${index + 1}: Valid amount is required`;
          }
          if (!entry.entry_type) {
            errors[`entry_${index}_type`] = `Entry ${index + 1}: Entry type is required`;
          }
        });
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      alert('Please fix the errors in the form');
      return;
    }
    
    try {
      const apiData = {
        date: editFormData.date,
        description: editFormData.description,
        reference: editFormData.reference || ''
      };
      
      if (isFullEditMode) {
        apiData.entries = editFormData.entries.map(entry => ({
          account_id: parseInt(entry.account_id),
          amount: parseFloat(entry.amount),
          entry_type: entry.entry_type
        }));
      }
      
      await accountingAPI.updateTransaction(transactionId, apiData);
      
      alert('Transaction updated successfully!');
      setEditingTransaction(null);
      setEditFormData({});
      setEditErrors({});
      setIsFullEditMode(false);
      loadTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Error updating transaction: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditCancel = () => {
    setEditingTransaction(null);
    setEditFormData({});
    setEditErrors({});
    setIsFullEditMode(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (editErrors[name]) {
      setEditErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleEntryChange = (index, field, value) => {
    const updatedEntries = [...editFormData.entries];
    
    if (field === 'account_id') {
      const selectedAccount = accounts.find(acc => acc.id === parseInt(value));
      if (selectedAccount) {
        updatedEntries[index].account_id = value;
        updatedEntries[index].account_code = selectedAccount.account_code;
        updatedEntries[index].account_name = selectedAccount.account_name;
      }
    } else if (field === 'amount') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        updatedEntries[index][field] = value;
      }
    } else {
      updatedEntries[index][field] = value;
    }
    
    setEditFormData(prev => ({
      ...prev,
      entries: updatedEntries
    }));
    
    if (editErrors.balance) {
      setEditErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.balance;
        return newErrors;
      });
    }
  };

  const addJournalEntry = () => {
    setEditFormData(prev => ({
      ...prev,
      entries: [
        ...prev.entries,
        {
          entry_id: `new_${Date.now()}`,
          account_id: '',
          account_code: '',
          account_name: '',
          amount: '',
          entry_type: 'Debit'
        }
      ]
    }));
  };

  const removeJournalEntry = (index) => {
    if (editFormData.entries.length <= 2) {
      alert('Transaction must have at least two entries');
      return;
    }
    
    const updatedEntries = [...editFormData.entries];
    updatedEntries.splice(index, 1);
    
    setEditFormData(prev => ({
      ...prev,
      entries: updatedEntries
    }));
  };

  const toggleEditMode = () => {
    if (isFullEditMode) {
      handleEdit(transactions.find(t => t.id === editingTransaction));
    } else {
      setIsFullEditMode(true);
    }
  };

  const calculateTransactionTotals = (entries) => {
    if (!entries || !Array.isArray(entries)) return { debits: 0, credits: 0, balanced: false };
    
    const debits = entries
      .filter(entry => entry.entry_type === 'Debit')
      .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
    
    const credits = entries
      .filter(entry => entry.entry_type === 'Credit')
      .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);

    return { 
      debits, 
      credits, 
      balanced: Math.abs(debits - credits) < 0.01 
    };
  };

  const wasTransactionUpdated = (transaction) => {
    if (!transaction.created_at || !transaction.updated_at) return false;
    
    const created = new Date(transaction.created_at).getTime();
    const updated = new Date(transaction.updated_at).getTime();
    
    return Math.abs(updated - created) > 1000;
  };

  if (loading) {
    return <div className="transaction-history">Loading transactions...</div>;
  }

  return (
    <div className="transaction-history">
      {/* ADD THIS: Role Indicator Header */}
      <div className="transaction-history-header">
        <div className="header-left">
          <div className="header-title-row">
            <h2>Transaction History</h2>
            <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
              {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
            </div>
          </div>
          
          {/* ADD THIS: Viewer Mode Warning */}
          {!isAdmin && (
            <div className="viewer-warning">
              <p>
                ⚠️ <strong>View-Only Mode:</strong> You can view all transactions but cannot edit or delete them.
              </p>
            </div>
          )}
        </div>
        
        <div className="header-controls">
          <div className="timestamp-toggle">
            <label>
              <input
                type="checkbox"
                checked={showTimestamps}
                onChange={(e) => setShowTimestamps(e.target.checked)}
              />
              Show Timestamps
            </label>
          </div>
          
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search by TID (e.g., 1, 2, 3...)"
              value={searchTID}
              onChange={(e) => setSearchTID(e.target.value)}
              className="search-input"
            />
            {searchTID && (
              <button 
                onClick={() => setSearchTID('')}
                className="search-clear"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search Results Info */}
      {searchTID && (
        <div className="search-results-info">
          <p>
            Showing {filteredTransactions.length} of {transactions.length} transactions 
            {searchTID && ` matching TID: "${searchTID}"`}
          </p>
        </div>
      )}
      
      {filteredTransactions.length === 0 ? (
        <div className="no-data">
          {searchTID ? (
            <>
              <p>No transactions found matching TID: "{searchTID}"</p>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
                Try searching with a different TID or clear the search to see all transactions.
              </p>
            </>
          ) : (
            <>
              <p>No transactions recorded yet.</p>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
                Try recording a transaction first, then check back here.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="transactions-list">
          {filteredTransactions.map(transaction => {
            const { debits, credits, balanced } = calculateTransactionTotals(transaction.entries);
            const wasUpdated = wasTransactionUpdated(transaction);
            const { debits: editDebits, credits: editCredits, balanced: editBalanced } = 
              editingTransaction === transaction.id ? calculateTransactionTotals(editFormData.entries) : { debits: 0, credits: 0, balanced: true };
            
            return (
              <div key={transaction.id} className="transaction-card">
                <div className="transaction-header">
                  <div className="transaction-info">
                    <div className="transaction-tid">
                      <strong>TID-{transaction.transaction_number || transaction.id}</strong>
                    </div>
                    <strong>Date: {formatDateForDisplay(transaction.date)}</strong>
                    <span>Reference: {transaction.reference || 'N/A'}</span>
                    <span>Description: {transaction.description}</span>
                    
                    {showTimestamps && (
                      <div className="transaction-timestamps">
                        <div className="timestamp-info">
                          <span className="timestamp-label">Created:</span>
                          <span className="timestamp-value">
                            {transaction.created_at_formatted?.fullDateTime || formatTimestamp(transaction.created_at)}
                          </span>
                        </div>
                        
                        {wasUpdated && transaction.updated_at && (
                          <div className="timestamp-info updated">
                            <span className="timestamp-label">Last Updated:</span>
                            <span className="timestamp-value">
                              {transaction.updated_at_formatted?.fullDateTime || formatTimestamp(transaction.updated_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!balanced && <span style={{color: 'red', fontWeight: 'bold'}}>⚠️ Unbalanced Transaction</span>}
                  </div>
                  
                  {/* ADD THIS: Conditionally show action buttons */}
                  {isAdmin ? (
                    <div className="transaction-actions">
                      {editingTransaction === transaction.id ? (
                        <>
                          <button 
                            onClick={() => handleEditSubmit(transaction.id)}
                            className="btn-primary"
                          >
                            Save
                          </button>
                          <button 
                            onClick={handleEditCancel}
                            className="btn-secondary"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={toggleEditMode}
                            className="btn-edit-mode"
                          >
                            {isFullEditMode ? 'Basic Edit' : 'Full Edit'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleEdit(transaction)}
                            className="btn-edit"
                            title="Edit this transaction"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(transaction.id)}
                            className="btn-delete"
                            title="Delete this transaction"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="transaction-actions">
                      <button 
                        className="btn-edit disabled"
                        disabled
                        title="Admin privileges required to edit transactions"
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-delete disabled"
                        disabled
                        title="Admin privileges required to delete transactions"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {editingTransaction === transaction.id && isAdmin ? (
                  <div className="edit-form">
                    <div className="form-group">
                      <label>Date (dd/mm/yyyy):</label>
                      <input
                        type="text"
                        name="date"
                        value={editFormData.date || ''}
                        onChange={handleInputChange}
                        placeholder="dd/mm/yyyy"
                        className={editErrors.date ? 'error' : ''}
                      />
                      {editErrors.date && <span className="error-message">{editErrors.date}</span>}
                      <small>Format: dd/mm/yyyy (e.g., 25/11/2024)</small>
                    </div>
                    
                    <div className="form-group">
                      <label>Description:</label>
                      <input
                        type="text"
                        name="description"
                        value={editFormData.description || ''}
                        onChange={handleInputChange}
                        className={editErrors.description ? 'error' : ''}
                      />
                      {editErrors.description && <span className="error-message">{editErrors.description}</span>}
                    </div>
                    
                    <div className="form-group">
                      <label>Reference:</label>
                      <input
                        type="text"
                        name="reference"
                        value={editFormData.reference || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    {isFullEditMode && (
                      <div className="journal-entries-edit">
                        <h4>Journal Entries:</h4>
                        {editErrors.entries && <div className="error-message">{editErrors.entries}</div>}
                        {editErrors.balance && <div className="error-message balance-error">{editErrors.balance}</div>}
                        
                        {loadingAccounts ? (
                          <div className="loading-message">
                            Loading accounts...
                          </div>
                        ) : accounts.length === 0 ? (
                          <div className="error-message">
                            No accounts available. Please create accounts first.
                          </div>
                        ) : (
                          <>
                            {editFormData.entries && editFormData.entries.map((entry, index) => (
                              <div key={entry.entry_id || index} className="edit-entry-row">
                                <div className="form-group">
                                  <label>Account:</label>
                                  <select
                                    value={entry.account_id || ''}
                                    onChange={(e) => handleEntryChange(index, 'account_id', e.target.value)}
                                    className={editErrors[`entry_${index}_account`] ? 'error' : ''}
                                  >
                                    <option value="">Select Account</option>
                                    {accounts.map(account => (
                                      <option key={account.id} value={account.id}>
                                        {account.account_code} - {account.account_name}
                                      </option>
                                    ))}
                                  </select>
                                  {editErrors[`entry_${index}_account`] && (
                                    <span className="error-message">{editErrors[`entry_${index}_account`]}</span>
                                  )}
                                  {entry.account_id && (
                                    <div style={{ 
                                      background: '#f0f8ff', 
                                      padding: '5px', 
                                      marginTop: '5px', 
                                      borderRadius: '3px',
                                      fontSize: '12px',
                                      borderLeft: '3px solid #4a90e2'
                                    }}>
                                      <strong>Current:</strong> {entry.account_code} - {entry.account_name}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="form-group">
                                  <label>Amount:</label>
                                  <input
                                    type="number"
                                    value={entry.amount || ''}
                                    onChange={(e) => handleEntryChange(index, 'amount', e.target.value)}
                                    step="0.01"
                                    min="0"
                                    className={editErrors[`entry_${index}_amount`] ? 'error' : ''}
                                  />
                                  {editErrors[`entry_${index}_amount`] && (
                                    <span className="error-message">{editErrors[`entry_${index}_amount`]}</span>
                                  )}
                                </div>
                                
                                <div className="form-group">
                                  <label>Type:</label>
                                  <select
                                    value={entry.entry_type || 'Debit'}
                                    onChange={(e) => handleEntryChange(index, 'entry_type', e.target.value)}
                                  >
                                    <option value="Debit">Debit</option>
                                    <option value="Credit">Credit</option>
                                  </select>
                                </div>
                                
                                <div className="form-group">
                                  <label>&nbsp;</label>
                                  <button 
                                    onClick={() => removeJournalEntry(index)}
                                    className="btn-remove-entry"
                                    disabled={editFormData.entries.length <= 2}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            <div className="edit-entry-actions">
                              <button onClick={addJournalEntry} className="btn-add-entry">
                                + Add Entry
                              </button>
                            </div>
                          </>
                        )}
                        
                        <div className="edit-totals">
                          <p><strong>Total Debits:</strong> {formatCurrency(editDebits)}</p>
                          <p><strong>Total Credits:</strong> {formatCurrency(editCredits)}</p>
                          <p className={editBalanced ? 'balanced' : 'unbalanced'}>
                            {editBalanced ? '✓ Balanced' : '✗ Not Balanced'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {!isFullEditMode && (
                      <div className="journal-entries-readonly">
                        <h4>Journal Entries (Read-only in basic edit mode):</h4>
                        {editFormData.entries && editFormData.entries.map((entry, index) => (
                          <div key={index} className="readonly-entry-row">
                            <div className="form-group">
                              <label>Account:</label>
                              <input
                                type="text"
                                value={`${entry.account_code} - ${entry.account_name}`}
                                readOnly
                                className="readonly-field"
                              />
                            </div>
                            <div className="form-group">
                              <label>Amount:</label>
                              <input
                                type="text"
                                value={formatCurrency(parseFloat(entry.amount) || 0)}
                                readOnly
                                className="readonly-field"
                              />
                            </div>
                            <div className="form-group">
                              <label>Type:</label>
                              <input
                                type="text"
                                value={entry.entry_type}
                                readOnly
                                className="readonly-field"
                              />
                            </div>
                          </div>
                        ))}
                        <div className="edit-totals">
                          <p><strong>Total Debits:</strong> {formatCurrency(debits)}</p>
                          <p><strong>Total Credits:</strong> {formatCurrency(credits)}</p>
                          <p className={balanced ? 'balanced' : 'unbalanced'}>
                            {balanced ? '✓ Balanced' : '✗ Not Balanced'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="journal-entries">
                      <h4>Journal Entries:</h4>
                      {transaction.entries.map((entry) => (
                        <div key={entry.id} className={`journal-entry-item ${entry.entry_type.toLowerCase()}`}>
                          <span>{entry.account_code} - {entry.account_name}</span>
                          <span className={entry.entry_type === 'Debit' ? 'amount-positive' : 'amount-neutral'}>
                            {formatCurrency(entry.amount)} ({entry.entry_type})
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="transaction-totals">
                      <p><strong>Total Debits:</strong> {formatCurrency(debits)}</p>
                      <p><strong>Total Credits:</strong> {formatCurrency(credits)}</p>
                      <p className={balanced ? 'balanced' : 'unbalanced'}>
                        {balanced ? '✓ Balanced' : '✗ Not Balanced'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;