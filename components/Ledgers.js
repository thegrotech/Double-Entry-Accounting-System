import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatTimestamp, formatDateOnly } from '../utils/timeFormatter';
import AuthService from '../utils/auth'; // ADD THIS IMPORT

const Ledgers = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingLedger, setGeneratingLedger] = useState(false);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  
  // ADD THIS: Get user role
  const isAdmin = AuthService.isAdmin();
  const userRole = AuthService.getRole();

  useEffect(() => {
    loadAccounts();
    loadCompanyDetails();
  }, []);

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

  const loadCompanyDetails = async () => {
    try {
      const response = await accountingAPI.getCompanyDetails();
      setCompanyDetails(response.data);
    } catch (error) {
      console.error('Error loading company details:', error);
    }
  };

  const handleViewLedger = async () => {
    if (!selectedAccount || !startDate || !endDate) {
      alert('Please select an account and date range');
      return;
    }

    try {
      setGeneratingLedger(true);
      
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        alert('Please use dd/mm/yyyy format for dates');
        return;
      }

      const response = await accountingAPI.getAccountLedger(selectedAccount, startDate, endDate);
      const ledgerData = response.data;
      
      openLedgerInNewTab(ledgerData);
      
    } catch (error) {
      console.error('Error generating ledger:', error);
      alert('Error generating ledger: ' + (error.response?.data?.error || error.message));
    } finally {
      setGeneratingLedger(false);
    }
  };

  // Helper function to extract time only from formatted timestamp
  const extractTimeOnly = (formattedTimestamp) => {
    if (!formattedTimestamp) return 'N/A';
    
    try {
      // If timestamp is in format "25/12/2024 02:30:45 PM"
      const parts = formattedTimestamp.split(' ');
      if (parts.length >= 3) {
        // Return time part only: "02:30:45 PM"
        return `${parts[1]} ${parts[2]}`;
      }
      
      // If it's a different format, try to parse as date
      const date = new Date(formattedTimestamp);
      if (!isNaN(date.getTime())) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12;
        
        return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
      }
      
      return formattedTimestamp;
    } catch (error) {
      console.error('Error extracting time:', error);
      return formattedTimestamp;
    }
  };

  const openLedgerInNewTab = (ledgerData) => {
    const newWindow = window.open('', '_blank');
    
    const companyName = companyDetails?.company?.name || 'Your Business Name';
    const companyAddress = companyDetails?.company?.address || 'Business Address';
    const companyPhone = companyDetails?.company?.phone || 'Business Phone';
    const companyEmail = companyDetails?.company?.email || 'Business Email';
    const preparedBy = companyDetails?.system?.prepared_by || 'Manager';

    const currentTime = new Date();
    const reportGeneratedAt = formatTimestamp(currentTime.toISOString());

    const ledgerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Ledger - ${ledgerData.account.account_name}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 0;
            padding: 2rem;
            color: #1f2937;
            background: white;
            line-height: 1.6;
          }
          
          .print-controls {
            text-align: center;
            margin-bottom: 2rem;
            padding: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            display: flex;
            justify-content: center;
            gap: 1rem;
            flex-wrap: wrap;
          }
          
          .print-button, .timestamp-toggle-btn { 
            padding: 12px 24px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .print-button:hover, .timestamp-toggle-btn:hover {
            background: #f8fafc;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          }
          
          .timestamp-toggle-btn.active {
            background: #667eea;
            color: white;
          }
          
          .ledger-header { 
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3rem;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 3px solid #e5e7eb;
          }
          
          .company-brand {
            display: flex;
            align-items: flex-start;
            gap: 1.5rem;
          }
          
          .company-info h1 {
            font-size: 2.25rem;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 0.5rem 0;
            line-height: 1.2;
          }
          
          .company-info p {
            margin: 0.25rem 0;
            color: #6b7280;
          }
          
          .ledger-meta {
            text-align: right;
          }
          
          .ledger-title {
            font-size: 2rem;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 1rem 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .account-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #4b5563;
            margin: 0 0 1.5rem 0;
          }
          
          .meta-info {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .meta-item {
            font-size: 0.95rem;
            color: #6b7280;
          }
          
          .meta-item strong {
            color: #4b5563;
          }
          
          .timestamp-info {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 12px;
            margin: 1rem 0;
            font-size: 0.9rem;
            color: #0369a1;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .timestamp-info:before {
            content: "⏰";
            font-size: 1.2rem;
          }
          
          .account-info-section {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 2rem;
            border-radius: 16px;
            margin-bottom: 3rem;
            border-left: 6px solid #667eea;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
          }
          
          .info-item {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .info-item label {
            font-size: 0.875rem;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .info-item span {
            font-size: 1.1rem;
            font-weight: 500;
            color: #1f2937;
          }
          
          .balance-type.debit {
            color: #dc2626;
            font-weight: 600;
          }
          
          .balance-type.credit {
            color: #059669;
            font-weight: 600;
          }
          
          .table-container {
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
            margin-bottom: 3rem;
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 0.9rem;
            background: white;
          }
          
          th { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 600;
            padding: 1rem 0.75rem;
            text-align: left;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: none;
          }
          
          td { 
            padding: 1rem 0.75rem;
            border-bottom: 1px solid #f3f4f6;
            text-align: left;
          }
          
          tr:hover {
            background-color: #f8fafc;
          }
          
          .date-col { width: 100px; }
          .tid-col { width: 90px; }
          .desc-col { width: auto; }
          .ref-col { width: 120px; }
          .timestamp-col { width: 110px; }
          .amount-col { width: 120px; }
          
          .date-cell, .tid-cell, .timestamp-cell {
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
            font-size: 0.85rem;
            color: #6b7280;
          }
          
          .desc-cell {
            color: #374151;
            font-weight: 500;
          }
          
          .ref-cell {
            color: #6b7280;
            font-style: italic;
          }
          
          .timestamp-cell {
            font-size: 0.8rem;
            color: #6b7280;
          }
          
          .amount-cell {
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
            font-weight: 600;
            text-align: right;
          }
          
          .debit {
            color: #dc2626;
          }
          
          .credit {
            color: #059669;
          }
          
          .balance.positive {
            color: #059669;
          }
          
          .balance.negative {
            color: #dc2626;
          }
          
          .summary-row {
            background-color: #f8fafc !important;
            font-weight: 600;
          }
          
          .summary-row.opening {
            border-top: 2px solid #10b981;
          }
          
          .summary-row.closing {
            border-top: 2px solid #3b82f6;
            border-bottom: 2px solid #3b82f6;
          }
          
          .ledger-summary-section {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            padding: 2rem;
            border-radius: 16px;
            margin-bottom: 3rem;
            border-left: 6px solid #0ea5e9;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
          }
          
          .summary-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e0f2fe;
          }
          
          .summary-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
          }
          
          .summary-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1f2937;
          }
          
          .summary-value.positive {
            color: #059669;
          }
          
          .summary-value.negative {
            color: #dc2626;
          }
          
          .summary-value.count {
            color: #7c3aed;
          }
          
          .ledger-footer {
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
          }
          
          @media print {
            @page {
              margin: 0.5in;
              size: landscape;
            }
            
            .print-controls { display: none !important; }
            body { margin: 0; padding: 0; }
            .ledger-header { 
              grid-template-columns: 1fr;
              gap: 1rem;
              margin-bottom: 1.5rem;
            }
            .company-brand { justify-content: center; text-align: center; }
            .ledger-meta { text-align: center; }
            .ledger-title { font-size: 1.5rem; }
            .account-title { font-size: 1.25rem; }
            .account-info-section, .ledger-summary-section { 
              padding: 1rem; 
              margin-bottom: 1.5rem;
            }
            table { font-size: 11px; }
            th, td { padding: 0.5rem 0.25rem; }
            .summary-grid { grid-template-columns: repeat(4, 1fr); gap: 1rem; }
            .summary-card { padding: 1rem; }
            .summary-value { font-size: 1.25rem; }
            .timestamp-col { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-controls">
          <button class="print-button" onclick="window.print()">🖨️ Print Ledger</button>
          <button class="timestamp-toggle-btn" id="toggleTimestamps" onclick="toggleTimestampColumn()">
            ⏰ Show/Hide Timestamps
          </button>
        </div>

        <div class="timestamp-info">
          All timestamps shown in Pakistan time (UTC+5). Click the button above to show/hide transaction timestamps.
        </div>

        <div class="ledger-header">
          <div class="company-brand">
            <div class="company-info">
              <h1 class="company-name">${companyName}</h1>
              <p class="company-address">${companyAddress}</p>
              <p class="company-contact">Phone: ${companyPhone} | Email: ${companyEmail}</p>
            </div>
          </div>
          
          <div class="ledger-meta">
            <div class="ledger-title-section">
              <h2 class="ledger-title">ACCOUNT LEDGER</h2>
              <h3 class="account-title">${ledgerData.account.account_name} (${ledgerData.account.account_code})</h3>
            </div>
            <div class="meta-info">
              <div class="meta-item">
                <strong>Period:</strong> ${ledgerData.period.startDate} to ${ledgerData.period.endDate}
              </div>
              <div class="meta-item">
                <strong>Prepared by:</strong> ${preparedBy}
              </div>
              <div class="meta-item">
                <strong>Report Generated:</strong> ${reportGeneratedAt}
              </div>
            </div>
          </div>
        </div>

        <div class="account-info-section">
          <div class="info-grid">
            <div class="info-item">
              <label>Account Name:</label>
              <span>${ledgerData.account.account_name}</span>
            </div>
            <div class="info-item">
              <label>Account Code:</label>
              <span>${ledgerData.account.account_code}</span>
            </div>
            <div class="info-item">
              <label>Account Type:</label>
              <span>${ledgerData.account.account_type}</span>
            </div>
            <div class="info-item">
              <label>Normal Balance:</label>
              <span class="balance-type ${ledgerData.account.normal_balance.toLowerCase()}">
                ${ledgerData.account.normal_balance}
              </span>
            </div>
            <div class="info-item">
              <label>Account Created:</label>
              <span>${ledgerData.account.created_at_formatted || ledgerData.account.created_at || ''}</span>
            </div>
            <div class="info-item">
              <label>Account Last Updated:</label>
              <span>${ledgerData.account.updated_at_formatted || ledgerData.account.updated_at || ''}</span>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table class="ledger-table" id="ledgerTable">
            <thead>
              <tr>
                <th class="date-col">Date</th>
                <th class="tid-col">TID</th>
                <th class="desc-col">Description</th>
                <th class="ref-col">Reference</th>
                <th class="timestamp-col" id="timestampHeader">Recorded At</th>
                <th class="amount-col">Debit (Rs.)</th>
                <th class="amount-col">Credit (Rs.)</th>
                <th class="amount-col">Balance (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="summary-row opening">
                <td class="date-cell">${ledgerData.period.startDate}</td>
                <td class="tid-cell">-</td>
                <td class="desc-cell"><strong>Opening Balance</strong></td>
                <td class="ref-cell">-</td>
                <td class="timestamp-cell">-</td>
                <td class="amount-cell">-</td>
                <td class="amount-cell">-</td>
                <td class="amount-cell balance ${ledgerData.openingBalance >= 0 ? 'positive' : 'negative'}">
                  <strong>${ledgerData.openingBalance.toFixed(2)}</strong>
                </td>
              </tr>

              ${ledgerData.transactions.map((transaction, index) => {
                const timeOnly = extractTimeOnly(transaction.created_at || transaction.created_at_formatted);
                
                return `
                <tr class="transaction-row">
                  <td class="date-cell">${transaction.date}</td>
                  <td class="tid-cell">${transaction.transaction_id || `T${String(index + 1).padStart(4, '0')}`}</td>
                  <td class="desc-cell">${transaction.description}</td>
                  <td class="ref-cell">${transaction.reference || '-'}</td>
                  <td class="timestamp-cell">${timeOnly}</td>
                  <td class="amount-cell debit">
                    ${transaction.entry_type === 'Debit' ? transaction.amount.toFixed(2) : '-'}
                  </td>
                  <td class="amount-cell credit">
                    ${transaction.entry_type === 'Credit' ? transaction.amount.toFixed(2) : '-'}
                  </td>
                  <td class="amount-cell balance ${transaction.running_balance >= 0 ? 'positive' : 'negative'}">
                    ${transaction.running_balance.toFixed(2)}
                  </td>
                </tr>
              `}).join('')}

              <tr class="summary-row closing">
                <td class="date-cell">${ledgerData.period.endDate}</td>
                <td class="tid-cell">-</td>
                <td class="desc-cell"><strong>Closing Balance</strong></td>
                <td class="ref-cell">-</td>
                <td class="timestamp-cell">-</td>
                <td class="amount-cell">-</td>
                <td class="amount-cell">-</td>
                <td class="amount-cell balance ${ledgerData.closingBalance >= 0 ? 'positive' : 'negative'}">
                  <strong>${ledgerData.closingBalance.toFixed(2)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="ledger-summary-section">
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Opening Balance</div>
              <div class="summary-value">Rs. ${ledgerData.openingBalance.toFixed(2)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Closing Balance</div>
              <div class="summary-value">Rs. ${ledgerData.closingBalance.toFixed(2)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Net Change</div>
              <div class="summary-value ${ledgerData.closingBalance - ledgerData.openingBalance >= 0 ? 'positive' : 'negative'}">
                Rs. ${(ledgerData.closingBalance - ledgerData.openingBalance).toFixed(2)}
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Transactions</div>
              <div class="summary-value count">${ledgerData.transactions.length}</div>
            </div>
          </div>
        </div>

        <div class="ledger-footer">
          <p>Generated on ${reportGeneratedAt} | ${companyName} Accounting System | Timezone: Pakistan (UTC+5)</p>
        </div>

        <script>
          window.focus();
          
          function toggleTimestampColumn() {
            const table = document.getElementById('ledgerTable');
            const header = document.getElementById('timestampHeader');
            const button = document.getElementById('toggleTimestamps');
            const timestampCells = table.querySelectorAll('.timestamp-cell');
            
            if (timestampCells[0].style.display === 'none') {
              header.style.display = '';
              timestampCells.forEach(cell => cell.style.display = '');
              button.classList.add('active');
              button.innerHTML = '⏰ Hide Timestamps';
            } else {
              header.style.display = 'none';
              timestampCells.forEach(cell => cell.style.display = 'none');
              button.classList.remove('active');
              button.innerHTML = '⏰ Show Timestamps';
            }
          }
          
          document.addEventListener('DOMContentLoaded', function() {
            const button = document.getElementById('toggleTimestamps');
            button.classList.add('active');
            button.innerHTML = '⏰ Hide Timestamps';
          });
        </script>
      </body>
      </html>
    `;
    
    newWindow.document.write(ledgerHTML);
    newWindow.document.close();
  };

  if (loading) {
    return <div className="ledgers">Loading accounts...</div>;
  }

  return (
    <div className="ledgers">
      {/* ADD THIS: Role Indicator Header */}
      <div className="page-header">
        <div className="header-title-row">
          <h2>Account Ledgers</h2>
          <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
            {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
          </div>
        </div>
        
        <p>View detailed transaction history for specific accounts</p>
        
        {/* ADD THIS: Role Info */}
        <div className="viewer-warning">
          <small>
            {isAdmin 
              ? '🔑 You have full administrative access to all features.'
              : '👁️ You are in view-only mode. You can generate and view all ledger reports but cannot modify data.'
            }
          </small>
        </div>
        
        <div className="timestamp-info-note">
          <small>
            ⏰ All ledger reports now include transaction timestamps recorded in Pakistan time (UTC+5).
            <br />
            📍 Timestamps show exactly when each transaction was recorded in the system.
          </small>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Generate Ledger Report</h3>
          {/* ADD THIS: Access Info */}
          <div className="access-info">
            <small>
              <strong>Access:</strong> Both admins and viewers can generate ledger reports
            </small>
          </div>
        </div>
        
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="account-select" className="form-label">
              Select Account *
            </label>
            <select
              id="account-select"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="form-select"
              title="Select an account to view its ledger"
            >
              <option value="">-- Choose an Account --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code} - {account.account_name} ({account.account_type})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start-date" className="form-label">
                From Date * (dd/mm/yyyy)
              </label>
              <input
                type="text"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                placeholder="dd/mm/yyyy"
                title="Enter start date in dd/mm/yyyy format"
              />
              <small>Format: dd/mm/yyyy (e.g., 25/11/2024)</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="end-date" className="form-label">
                To Date * (dd/mm/yyyy)
              </label>
              <input
                type="text"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
                placeholder="dd/mm/yyyy"
                title="Enter end date in dd/mm/yyyy format"
              />
              <small>Format: dd/mm/yyyy (e.g., 31/12/2024)</small>
            </div>
          </div>

          <div className="timestamp-settings">
            <div className="form-check">
              <input
                type="checkbox"
                id="showTimestamps"
                checked={showTimestamps}
                onChange={(e) => setShowTimestamps(e.target.checked)}
                className="form-check-input"
                title="Include transaction timestamps in the ledger report"
              />
              <label htmlFor="showTimestamps" className="form-check-label">
                Include transaction timestamps in ledger
              </label>
            </div>
            <small className="form-text text-muted">
              Shows exact time when each transaction was recorded
            </small>
          </div>

          <div className="form-actions">
            <button
              onClick={handleViewLedger}
              disabled={!selectedAccount || !startDate || !endDate || generatingLedger}
              className="btn btn-primary"
              title="Generate and view the ledger report"
            >
              {generatingLedger ? 'Generating Ledger...' : 'View Ledger'}
            </button>
          </div>
        </div>
      </div>

      <div className="help-text">
        <p><strong>How to use:</strong></p>
        <ul>
          <li>Select an account from the dropdown</li>
          <li>Choose the date range in dd/mm/yyyy format</li>
          <li><strong>New:</strong> Enable "Include transaction timestamps" to see when each transaction was recorded</li>
          <li>Click "View Ledger" to see the detailed transaction history in a new tab</li>
          <li><strong>New:</strong> Use the "Show/Hide Timestamps" button in the ledger to toggle timestamp column</li>
          <li>Use the print button in the new tab to print the ledger</li>
          <li>The ledger shows opening balance, all transactions, running balance, and closing balance</li>
        </ul>
        
        {/* ADD THIS: Role-specific info */}
        <div className="role-usage-info">
          <p><strong>Role Information:</strong></p>
          <ul>
            {isAdmin ? (
              <>
                <li>🔑 <strong>Admin:</strong> You have full access to all features including data modification</li>
                <li>👁️ <strong>Viewers:</strong> Can only view and generate reports, cannot modify data</li>
              </>
            ) : (
              <>
                <li>👁️ <strong>Viewer Mode:</strong> You can explore all ledger features</li>
                <li>📊 All reports are read-only for demonstration purposes</li>
                <li>🖨️ You can generate and print any ledger report</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Ledgers;