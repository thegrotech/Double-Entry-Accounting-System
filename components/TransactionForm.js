import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatCurrency } from '../utils/currencyFormatter';
import { getCurrentKarachiTime, formatTimestamp } from '../utils/timeFormatter';
import AuthService from '../utils/auth'; // ADD THIS IMPORT

const TransactionForm = ({ onTransactionAdded }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextTID, setNextTID] = useState('');
  const [formData, setFormData] = useState({
    date: '',
    description: '',
    reference: '',
    entries: [{ account_id: '', amount: '', entry_type: 'Debit' }]
  });
  const [currentKarachiTime, setCurrentKarachiTime] = useState(null);
  const [lastTransactionTimestamp, setLastTransactionTimestamp] = useState(null);
  
  // ADD THIS: Get user role
  const isAdmin = AuthService.isAdmin();
  const userRole = AuthService.getRole();

  // Load accounts and next TID on component mount
  useEffect(() => {
    loadAccounts();
    loadNextTID();
    setDefaultDate();
    updateCurrentTime();
  }, []);

  // Update current time every minute
  useEffect(() => {
    const intervalId = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const updateCurrentTime = () => {
    const karachiTime = getCurrentKarachiTime();
    setCurrentKarachiTime(karachiTime);
  };

  const setDefaultDate = () => {
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;
    
    setFormData(prev => ({
      ...prev,
      date: formattedDate
    }));
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await accountingAPI.getAccounts();
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
      alert('Error loading accounts: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNextTID = async () => {
    try {
      const response = await accountingAPI.getNextTransactionNumber();
      setNextTID(response.data.nextTID);
    } catch (error) {
      console.error('Error loading next TID:', error);
    }
  };

  const handleInputChange = (e) => {
    // ADD THIS: Prevent changes for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to modify transactions');
      return;
    }
    
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEntryChange = (index, field, value) => {
    // ADD THIS: Prevent changes for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to modify journal entries');
      return;
    }
    
    const updatedEntries = [...formData.entries];
    updatedEntries[index][field] = value;
    setFormData(prev => ({
      ...prev,
      entries: updatedEntries
    }));
  };

  const addEntry = () => {
    // ADD THIS: Prevent adding entries for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to add journal entries');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, { account_id: '', amount: '', entry_type: 'Debit' }]
    }));
  };

  const removeEntry = (index) => {
    // ADD THIS: Prevent removing entries for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to remove journal entries');
      return;
    }
    
    if (formData.entries.length > 1) {
      const updatedEntries = formData.entries.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        entries: updatedEntries
      }));
    }
  };

  // Helper function to validate dd/mm/yyyy format
  const isValidDateFormat = (dateStr) => {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateStr)) return false;
    
    const parts = dateStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Check if date is valid
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ADD THIS: Prevent submission for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to record transactions');
      return;
    }
    
    try {
      // Validate date format
      if (!isValidDateFormat(formData.date)) {
        alert('Please enter a valid date in dd/mm/yyyy format (e.g., 25/11/2024)');
        return;
      }

      // Convert amount to numbers and account_id to integers
      const transactionData = {
        ...formData,
        entries: formData.entries.map(entry => ({
          ...entry,
          account_id: parseInt(entry.account_id),
          amount: parseFloat(entry.amount)
        }))
      };

      const response = await accountingAPI.createTransaction(transactionData);
      const timestamp = response.data?.created_at || response.data?.timestamp;
      
      if (timestamp) {
        setLastTransactionTimestamp(timestamp);
      }
      
      const successMessage = timestamp 
        ? `Transaction TID-${nextTID} recorded successfully!\n\n📅 Recorded at: ${formatTimestamp(timestamp)}\n📍 Timezone: Karachi, Pakistan (UTC+5)`
        : `Transaction TID-${nextTID} recorded successfully!`;
      
      alert(successMessage);
      
      // Reset form
      setFormData({
        date: '',
        description: '',
        reference: '',
        entries: [{ account_id: '', amount: '', entry_type: 'Debit' }]
      });
      
      setDefaultDate();
      loadNextTID();

      if (onTransactionAdded) {
        onTransactionAdded();
      }
    } catch (error) {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const calculateTotals = () => {
    const debits = formData.entries
      .filter(entry => entry.entry_type === 'Debit')
      .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
    
    const credits = formData.entries
      .filter(entry => entry.entry_type === 'Credit')
      .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);

    return { debits, credits, balanced: Math.abs(debits - credits) < 0.01 };
  };

  const { debits, credits, balanced } = calculateTotals();

  // Group accounts by type for better organization in dropdown
  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {});

  if (loading) {
    return <div className="transaction-form">Loading accounts...</div>;
  }

  return (
    <div className="transaction-form">
      {/* ADD THIS: Role Indicator Header */}
      <div className="form-header">
        <h2>Record New Transaction</h2>
        <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
          {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
        </div>
      </div>
      
      {/* ADD THIS: Viewer Mode Warning */}
      {!isAdmin && (
        <div className="viewer-warning-card">
          <div className="warning-content">
            <h4>⚠️ View-Only Mode</h4>
            <p>
              You are in <strong>Viewer Mode</strong>. You can explore the transaction form 
              but cannot record transactions. All form fields are disabled.
            </p>
            <p>
              <em>Contact an administrator to record transactions or switch to an admin account.</em>
            </p>
          </div>
        </div>
      )}

      {/* Current Time Display */}
      {currentKarachiTime && (
        <div className="time-info-card">
          <div className="time-header">
            <h4>⏰ Current Pakistan Time</h4>
            <p className="current-time">
              {currentKarachiTime.fullDateTime}
            </p>
            <small className="timezone-note">
              All timestamps will be recorded in Pakistan time (UTC+5)
            </small>
          </div>
        </div>
      )}
      
      {/* Last Transaction Timestamp */}
      {lastTransactionTimestamp && (
        <div className="last-transaction-card success">
          <div className="timestamp-info">
            <p>
              ✅ <strong>Last Transaction Recorded:</strong> {formatTimestamp(lastTransactionTimestamp)}
            </p>
          </div>
        </div>
      )}

      {/* TID Display */}
      {nextTID && (
        <div className="tid-display-card">
          <div className="tid-header">
            <h3>📋 Transaction #: TID-{nextTID}</h3>
            <p>This transaction will be recorded with Transaction ID: <strong>TID-{nextTID}</strong></p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Date (dd/mm/yyyy):</label>
          <input
            type="text"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            placeholder="dd/mm/yyyy"
            required
            disabled={!isAdmin}
            title={!isAdmin ? "Admin privileges required to modify date" : ""}
          />
          <small>Format: dd/mm/yyyy (e.g., 25/11/2024)</small>
        </div>

        <div className="form-group">
          <label>Description:</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Enter transaction description"
            required
            disabled={!isAdmin}
            title={!isAdmin ? "Admin privileges required to modify description" : ""}
          />
        </div>

        <div className="form-group">
          <label>Reference:</label>
          <input
            type="text"
            name="reference"
            value={formData.reference}
            onChange={handleInputChange}
            placeholder="Optional reference"
            disabled={!isAdmin}
            title={!isAdmin ? "Admin privileges required to modify reference" : ""}
          />
        </div>

        <h3>Journal Entries</h3>
        {formData.entries.map((entry, index) => (
          <div key={index} className="journal-entry">
            <select
              value={entry.account_id}
              onChange={(e) => handleEntryChange(index, 'account_id', e.target.value)}
              required
              disabled={!isAdmin}
              title={!isAdmin ? "Admin privileges required to select accounts" : ""}
            >
              <option value="">Select Account</option>
              {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
                <optgroup key={type} label={type}>
                  {typeAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} ({account.normal_balance})
                      {account.account_subtype && ` - ${account.account_subtype}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              value={entry.amount}
              onChange={(e) => handleEntryChange(index, 'amount', e.target.value)}
              required
              disabled={!isAdmin}
              title={!isAdmin ? "Admin privileges required to enter amounts" : ""}
            />

            <select
              value={entry.entry_type}
              onChange={(e) => handleEntryChange(index, 'entry_type', e.target.value)}
              disabled={!isAdmin}
              title={!isAdmin ? "Admin privileges required to select entry type" : ""}
            >
              <option value="Debit">Debit</option>
              <option value="Credit">Credit</option>
            </select>

            <button 
              type="button" 
              onClick={() => removeEntry(index)}
              className="btn-delete"
              disabled={!isAdmin}
              title={!isAdmin ? "Admin privileges required to remove entries" : ""}
            >
              Remove
            </button>
          </div>
        ))}

        <div className="entry-controls">
          <button 
            type="button" 
            onClick={addEntry}
            disabled={!isAdmin}
            title={!isAdmin ? "Admin privileges required to add entries" : ""}
          >
            Add Another Entry
          </button>
        </div>

        <div className="totals">
          <p>Total Debits: {formatCurrency(debits)}</p>
          <p>Total Credits: {formatCurrency(credits)}</p>
          <p style={{ color: balanced ? 'green' : 'red' }}>
            {balanced ? '✓ Balanced' : '✗ Not Balanced'}
          </p>
        </div>

        <button 
          type="submit" 
          disabled={!balanced || loading || !isAdmin}
          className={isAdmin ? 'btn-submit' : 'btn-disabled'}
          title={!isAdmin ? "Admin privileges required to record transactions" : balanced ? "Record this transaction" : "Transaction must be balanced"}
        >
          {loading ? 'Processing...' : isAdmin ? `Record Transaction TID-${nextTID}` : 'Record Transaction (Admin Required)'}
        </button>
        
        {/* Recording Info Note */}
        <div className="recording-note">
          <small>
            ⏰ This transaction will be timestamped with current Pakistan time automatically.
            <br />
            📍 Timezone: Pakistan (UTC+5)
            {!isAdmin && (
              <>
                <br />
                <span style={{ color: '#dc3545' }}>
                  ⚠️ Viewer accounts cannot record transactions. Switch to admin account.
                </span>
              </>
            )}
          </small>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;