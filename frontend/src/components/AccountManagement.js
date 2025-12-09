import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatTimestamp } from '../utils/timeFormatter';
import AuthService from '../utils/auth'; // ADD THIS IMPORT

const AccountManagement = () => {
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    account_name: '',
    account_type: 'Asset',
    account_subtype: 'Current',
    normal_balance: 'Debit'
  });
  const [showAccountTimestamps, setShowAccountTimestamps] = useState(false);
  
  // ADD THIS: Get user role
  const isAdmin = AuthService.isAdmin();
  const userRole = AuthService.getRole();

  // Function to get appropriate subtypes based on account type
  const getSubtypeOptions = (accountType) => {
    switch (accountType) {
      case 'Asset':
        return [
          { value: 'Current', label: 'Current' },
          { value: 'NonCurrent', label: 'Non-Current' },
          { value: 'Operating', label: 'Operating' }
        ];
      case 'Liability':
        return [
          { value: 'Current', label: 'Current' },
          { value: 'NonCurrent', label: 'Non-Current' },
          { value: 'Operating', label: 'Operating' }
        ];
      case 'Capital':
        return [
          { value: 'OwnersCapital', label: "Owner's Capital" }
        ];
      case 'Revenue':
        return [
          { value: 'Operating', label: 'Operating' },
          { value: 'NonOperating', label: 'Non-Operating' }
        ];
      case 'Expense':
        return [
          { value: 'Operating', label: 'Operating' },
          { value: 'NonOperating', label: 'Non-Operating' }
        ];
      default:
        return [];
    }
  };

  // Function to get default subtype for each account type
  const getDefaultSubtype = (accountType) => {
    switch (accountType) {
      case 'Asset': return 'Current';
      case 'Liability': return 'Current';
      case 'Capital': return 'OwnersCapital';
      case 'Revenue': return 'Operating';
      case 'Expense': return 'Operating';
      default: return '';
    }
  };

  // Load accounts on component mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await accountingAPI.getAccountsHierarchy();
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
      alert('Error loading accounts: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    // ADD THIS: Prevent changes for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to modify accounts');
      return;
    }
    
    const { name, value } = e.target;
    
    if (name === 'account_type') {
      const defaultSubtype = getDefaultSubtype(value);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        account_subtype: defaultSubtype
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    
    // ADD THIS: Prevent creation for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to create accounts');
      return;
    }
    
    try {
      const response = await accountingAPI.createAccount(formData);
      const timestamp = response.data?.created_at || response.data?.timestamp;
      
      const successMessage = timestamp 
        ? `Account "${formData.account_name}" created successfully!\n\n📅 Created at: ${formatTimestamp(timestamp)}\n📍 Timezone: Karachi, Pakistan (UTC+5)`
        : `Account "${formData.account_name}" created successfully!`;
      
      alert(successMessage);
      
      setShowCreateForm(false);
      setFormData({
        account_name: '',
        account_type: 'Asset',
        account_subtype: 'Current',
        normal_balance: 'Debit'
      });
      loadAccounts();
    } catch (error) {
      alert('Error creating account: ' + error.response?.data?.error || error.message);
    }
  };

  const handleEditAccount = async (e) => {
    e.preventDefault();
    
    // ADD THIS: Prevent editing for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to edit accounts');
      return;
    }
    
    try {
      const response = await accountingAPI.updateAccount(editingAccount.id, formData);
      const timestamp = response.data?.updated_at;
      
      const successMessage = timestamp 
        ? `Account "${formData.account_name}" updated successfully!\n\n📅 Last updated: ${formatTimestamp(timestamp)}\n📍 Timezone: Karachi, Pakistan (UTC+5)`
        : `Account "${formData.account_name}" updated successfully!`;
      
      alert(successMessage);
      
      setEditingAccount(null);
      setFormData({
        account_name: '',
        account_type: 'Asset',
        account_subtype: 'Current',
        normal_balance: 'Debit'
      });
      loadAccounts();
    } catch (error) {
      alert('Error updating account: ' + error.response?.data?.error || error.message);
    }
  };

  const handleDeleteAccount = async (accountId, accountName) => {
    // ADD THIS: Prevent deletion for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to delete accounts');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete "${accountName}"? This action cannot be undone if the account has no transactions.`)) {
      return;
    }

    try {
      await accountingAPI.deleteAccount(accountId);
      alert('Account deleted successfully!');
      loadAccounts();
    } catch (error) {
      alert('Error deleting account: ' + error.response?.data?.error || error.message);
    }
  };

  const startEdit = (account) => {
    // ADD THIS: Prevent starting edit for viewers
    if (!isAdmin) {
      alert('⚠️ Admin privileges required to edit accounts');
      return;
    }
    
    setEditingAccount(account);
    setFormData({
      account_name: account.account_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype || '',
      normal_balance: account.normal_balance
    });
  };

  const cancelEdit = () => {
    setEditingAccount(null);
    setFormData({
      account_name: '',
      account_type: 'Asset',
      account_subtype: 'Current',
      normal_balance: 'Debit'
    });
  };

  const wasAccountUpdated = (account) => {
    if (!account.created_at || !account.updated_at) return false;
    
    const created = new Date(account.created_at).getTime();
    const updated = new Date(account.updated_at).getTime();
    
    return Math.abs(updated - created) > 1000;
  };

  if (loading) {
    return <div className="account-management">Loading accounts...</div>;
  }

  return (
    <div className="account-management">
      {/* ADD THIS: Role Indicator Header */}
      <div className="account-header">
        <div className="header-left">
          <div className="header-title-row">
            <h2>Chart of Accounts</h2>
            <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
              {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
            </div>
          </div>
          
          {/* ADD THIS: Viewer Mode Warning */}
          {!isAdmin && (
            <div className="viewer-warning-card">
              <p>
                ⚠️ <strong>View-Only Mode:</strong> You can view all accounts but cannot create, edit, or delete them.
              </p>
            </div>
          )}
          
          {/* Timestamp Toggle */}
          <div className="timestamp-toggle">
            <label>
              <input
                type="checkbox"
                checked={showAccountTimestamps}
                onChange={(e) => setShowAccountTimestamps(e.target.checked)}
              />
              Show Account Timestamps
            </label>
          </div>
        </div>
        
        {/* ADD THIS: Conditionally show/hide Create button */}
        {isAdmin && (
          <button 
            className="btn-primary"
            onClick={() => setShowCreateForm(true)}
            disabled={showCreateForm || editingAccount}
            title="Create a new account"
          >
            + Create New Account
          </button>
        )}
      </div>

      {/* Timestamp Info Note */}
      <div className="timestamp-info-note">
        <small>
          ⏰ All accounts are timestamped with Pakistan time (UTC+5). 
          {showAccountTimestamps ? ' Timestamps are shown below.' : ' Enable "Show Account Timestamps" to see them.'}
        </small>
      </div>

      {/* Create/Edit Form - Only show for admins */}
      {(showCreateForm || editingAccount) && isAdmin && (
        <div className="account-form">
          <h3>{editingAccount ? 'Edit Account' : 'Create New Account'}</h3>
          <form onSubmit={editingAccount ? handleEditAccount : handleCreateAccount}>
            <div className="form-group">
              <label>Account Name *</label>
              <input
                type="text"
                name="account_name"
                value={formData.account_name}
                onChange={handleInputChange}
                required
                placeholder="e.g., Cash, Accounts Payable, Sales Revenue"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Account Type *</label>
                <select
                  name="account_type"
                  value={formData.account_type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Expense">Operating Expense</option>
                  <option value="Revenue">Revenue</option>
                  <option value="Capital">Capital</option>
                </select>
              </div>

              <div className="form-group">
                <label>Normal Balance *</label>
                <select
                  name="normal_balance"
                  value={formData.normal_balance}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Debit">Debit</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Account Subtype</label>
              <select
                name="account_subtype"
                value={formData.account_subtype}
                onChange={handleInputChange}
              >
                <option value="">-- Select Subtype --</option>
                {getSubtypeOptions(formData.account_type).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Optional: Used for better organization</small>
            </div>

            <div className="account-creation-note">
              <small>
                ⏰ This account will be timestamped with current Pakistan time automatically.
                <br />
                📍 Timezone: Pakistan (UTC+5)
              </small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingAccount ? 'Update Account' : 'Create Account'}
              </button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={editingAccount ? cancelEdit : () => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts Display */}
      <div className="accounts-hierarchy">
        {/* Assets */}
        <div className="account-category">
          <h3>Assets</h3>
          <div className="account-subcategory">
            <h4>Current Assets</h4>
            {accounts.assets?.current.map(account => (
              <AccountItem 
                key={account.id} 
                account={account} 
                onEdit={startEdit}
                onDelete={handleDeleteAccount}
                showTimestamps={showAccountTimestamps}
                wasUpdated={wasAccountUpdated(account)}
                isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
              />
            ))}
          </div>
          <div className="account-subcategory">
            <h4>Non-Current Assets</h4>
            {accounts.assets?.nonCurrent.map(account => (
              <AccountItem 
                key={account.id} 
                account={account} 
                onEdit={startEdit}
                onDelete={handleDeleteAccount}
                showTimestamps={showAccountTimestamps}
                wasUpdated={wasAccountUpdated(account)}
                isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
              />
            ))}
          </div>
        </div>

        {/* Liabilities */}
        <div className="account-category">
          <h3>Liabilities</h3>
          <div className="account-subcategory">
            <h4>Current Liabilities</h4>
            {accounts.liabilities?.current.map(account => (
              <AccountItem 
                key={account.id} 
                account={account} 
                onEdit={startEdit}
                onDelete={handleDeleteAccount}
                showTimestamps={showAccountTimestamps}
                wasUpdated={wasAccountUpdated(account)}
                isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
              />
            ))}
          </div>
          <div className="account-subcategory">
            <h4>Non-Current Liabilities</h4>
            {accounts.liabilities?.nonCurrent.map(account => (
              <AccountItem 
                key={account.id} 
                account={account} 
                onEdit={startEdit}
                onDelete={handleDeleteAccount}
                showTimestamps={showAccountTimestamps}
                wasUpdated={wasAccountUpdated(account)}
                isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
              />
            ))}
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="account-category">
          <h3>Operating Expenses</h3>
          {accounts.expenses?.operating.map(account => (
            <AccountItem 
              key={account.id} 
              account={account} 
              onEdit={startEdit}
              onDelete={handleDeleteAccount}
              showTimestamps={showAccountTimestamps}
              wasUpdated={wasAccountUpdated(account)}
              isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
            />
          ))}
        </div>

        {/* Revenue */}
        <div className="account-category">
          <h3>Revenue</h3>
          {accounts.revenue?.map(account => (
            <AccountItem 
              key={account.id} 
              account={account} 
              onEdit={startEdit}
              onDelete={handleDeleteAccount}
              showTimestamps={showAccountTimestamps}
              wasUpdated={wasAccountUpdated(account)}
              isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
            />
          ))}
        </div>

        {/* Capital */}
        <div className="account-category">
          <h3>Capital</h3>
          {accounts.capital?.map(account => (
            <AccountItem 
              key={account.id} 
              account={account} 
              onEdit={startEdit}
              onDelete={handleDeleteAccount}
              showTimestamps={showAccountTimestamps}
              wasUpdated={wasAccountUpdated(account)}
              isAdmin={isAdmin} // ADD THIS: Pass isAdmin to AccountItem
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ✅ UPDATED: AccountItem component with role-based buttons
const AccountItem = ({ account, onEdit, onDelete, showTimestamps, wasUpdated, isAdmin }) => {
  return (
    <div className="account-item">
      <div className="account-info">
        <div className="account-main-info">
          <span className="account-code">{account.account_code}</span>
          <span className="account-name">{account.account_name}</span>
        </div>
        <div className="account-details">
          <span className="account-detail">
            Normal Balance: <strong>{account.normal_balance}</strong>
          </span>
          {account.account_subtype && (
            <span className="account-detail">
              Subtype: <strong>{account.account_subtype}</strong>
            </span>
          )}
          {account.balance !== 0 && (
            <span className="account-detail">
              Balance: <strong>Rs. {parseFloat(account.balance).toFixed(2)}</strong>
            </span>
          )}
        </div>
        
        {/* Timestamp Display */}
        {showTimestamps && (
          <div className="account-timestamps">
            <div className="account-timestamp">
              <span className="timestamp-label">Created:</span>
              <span className="timestamp-value">
                {account.created_at_formatted?.fullDateTime || formatTimestamp(account.created_at) || 'N/A'}
              </span>
            </div>
            
            {wasUpdated && account.updated_at && (
              <div className="account-timestamp updated">
                <span className="timestamp-label">Updated:</span>
                <span className="timestamp-value">
                  {account.updated_at_formatted?.fullDateTime || formatTimestamp(account.updated_at)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* ADD THIS: Conditionally show action buttons */}
      {isAdmin ? (
        <div className="account-actions">
          <button 
            className="btn-edit"
            onClick={() => onEdit(account)}
            title="Edit this account"
          >
            Edit
          </button>
          <button 
            className="btn-delete"
            onClick={() => onDelete(account.id, account.account_name)}
            title="Delete this account"
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="account-actions">
          <button 
            className="btn-edit disabled"
            disabled
            title="Admin privileges required to edit accounts"
          >
            Edit
          </button>
          <button 
            className="btn-delete disabled"
            disabled
            title="Admin privileges required to delete accounts"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;