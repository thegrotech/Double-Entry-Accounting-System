import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatCurrency } from '../utils/currencyFormatter';
import { getCurrentKarachiTime } from '../utils/timeFormatter';
import AuthService from '../utils/auth'; // ADD THIS IMPORT

const BalanceSheet = () => {
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usePeriod, setUsePeriod] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState(null);
  
  // ADD THIS: Get user role
  const isAdmin = AuthService.isAdmin();
  const userRole = AuthService.getRole();

  useEffect(() => {
    loadReports();
    setReportGeneratedAt(getCurrentKarachiTime());
  }, []);

  const loadReports = async (usePeriodFilter = false) => {
    try {
      setLoading(true);
      let balanceResponse, incomeResponse;
      
      if (usePeriodFilter && startDate && endDate) {
        setPeriodLoading(true);
        balanceResponse = await accountingAPI.getBalanceSheetForPeriod(startDate, endDate);
        incomeResponse = await accountingAPI.getIncomeStatementForPeriod(startDate, endDate);
      } else {
        balanceResponse = await accountingAPI.getBalanceSheet();
        incomeResponse = await accountingAPI.getIncomeStatement();
      }
      
      setBalanceSheet(balanceResponse.data);
      setIncomeStatement(incomeResponse.data);
      setReportGeneratedAt(getCurrentKarachiTime());
    } catch (error) {
      console.error('Error loading reports:', error);
      alert('Error loading reports: ' + error.message);
    } finally {
      setLoading(false);
      setPeriodLoading(false);
    }
  };

  const handlePeriodSubmit = (e) => {
    e.preventDefault();
    
    // Validate date format (dd/mm/yyyy)
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      alert('Please use dd/mm/yyyy format for dates (e.g., 25/11/2024)');
      return;
    }

    // Validate date range
    const startParts = startDate.split('/');
    const endParts = endDate.split('/');
    const startDateObj = new Date(startParts[2], startParts[1] - 1, startParts[0]);
    const endDateObj = new Date(endParts[2], endParts[1] - 1, endParts[0]);
    
    if (startDateObj > endDateObj) {
      alert('Start date cannot be after end date');
      return;
    }

    loadReports(true);
  };

  const handleResetPeriod = () => {
    setStartDate('');
    setEndDate('');
    setUsePeriod(false);
    loadReports(false);
  };

  const handleUsePeriodToggle = (checked) => {
    setUsePeriod(checked);
    if (!checked) {
      handleResetPeriod();
    }
  };

  // Calculate total capital including net income
  const calculateTotalCapitalWithNetIncome = () => {
    if (!balanceSheet || !incomeStatement) return 0;
    
    const baseCapital = balanceSheet.totalCapital || 0;
    const netIncome = incomeStatement.netIncome || 0;
    
    return baseCapital + netIncome;
  };

  // Check if balance sheet is balanced with net income included
  const isBalancedWithNetIncome = () => {
    if (!balanceSheet || !incomeStatement) return false;
    
    const totalAssets = balanceSheet.totalAssets || 0;
    const totalLiabilities = balanceSheet.totalLiabilities || 0;
    const totalCapitalWithNetIncome = calculateTotalCapitalWithNetIncome();
    
    return Math.abs(totalAssets - (totalLiabilities + totalCapitalWithNetIncome)) < 0.01;
  };

  if (loading) {
    return (
      <div className="balance-sheet">
        <div className="loading">Loading balance sheet...</div>
      </div>
    );
  }

  if (!balanceSheet || !incomeStatement) {
    return (
      <div className="balance-sheet">
        <div className="no-data">No balance sheet data available.</div>
      </div>
    );
  }

  const totalCapitalWithNetIncome = calculateTotalCapitalWithNetIncome();
  const isBalanced = isBalancedWithNetIncome();

  return (
    <div className="balance-sheet">
      <div className="report-header">
        {/* ADD THIS: Role Indicator Header */}
        <div className="header-title-row">
          <h2>Balance Sheet</h2>
          <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
            {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
          </div>
        </div>

        {/* ADD THIS: Role Info */}
        <div className="role-info-note">
          <small>
            {isAdmin 
              ? '🔑 You have full administrative access to all features.'
              : '👁️ You are in view-only mode. You can explore all reports but cannot modify data.'
            }
          </small>
        </div>

        {/* ✅ Report Generation Timestamp */}
        {reportGeneratedAt && (
          <div className="report-timestamp">
            <small>
              ⏰ Report generated: {reportGeneratedAt.fullDateTime} | 📍 Timezone: Pakistan (UTC+5)
            </small>
          </div>
        )}
        
        {/* Date Range Selector - ALLOWED FOR VIEWERS */}
        <div className="period-selector-card">
          <div className="period-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={usePeriod}
                onChange={(e) => handleUsePeriodToggle(e.target.checked)}
                className="toggle-checkbox"
                title="Toggle date period filter"
              />
              <span className="toggle-text">Show Specific Period</span>
            </label>
            <small className="period-hint">
              {isAdmin 
                ? 'Admins and viewers can filter by date period'
                : 'You can filter by date period to view specific time ranges'
              }
            </small>
          </div>
          
          {usePeriod && (
            <div className="period-form-container">
              <form onSubmit={handlePeriodSubmit} className="period-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">From Date *</label>
                    <input
                      type="text"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                      className="form-input"
                      required
                      title="Enter start date in dd/mm/yyyy format"
                    />
                    <small className="form-hint">Format: dd/mm/yyyy</small>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">To Date *</label>
                    <input
                      type="text"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                      className="form-input"
                      required
                      title="Enter end date in dd/mm/yyyy format"
                    />
                    <small className="form-hint">Format: dd/mm/yyyy</small>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={periodLoading}
                    title="Apply the selected date period"
                  >
                    {periodLoading ? 'Loading...' : 'Apply Period'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleResetPeriod}
                    className="btn btn-secondary"
                    title="Reset to all-time view"
                  >
                    Show All Time
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Period Info */}
        {balanceSheet.period && (
          <div className="period-info-card">
            <h3>As of {balanceSheet.period.endDate}</h3>
            <p>This report shows financial position for the period ending {balanceSheet.period.endDate}.</p>
          </div>
        )}
        
        {!balanceSheet.period && (
          <div className="period-info-card">
            <h3>Current Financial Position</h3>
            <p>This report shows the current financial position based on all transactions.</p>
          </div>
        )}
      </div>

      <div className="balance-sheet-content">
        {/* Assets Section */}
        <div className="assets-section report-section">
          <h3>Assets</h3>
          {balanceSheet.assets.length === 0 ? (
            <div className="no-accounts">
              <p>No asset accounts found for this period</p>
            </div>
          ) : (
            <div className="accounts-list">
              {balanceSheet.assets.map(asset => (
                <div key={asset.account_name} className="account-item">
                  <div className="account-name">{asset.account_name}</div>
                  <div className={`account-amount ${(asset.period_balance || asset.balance) >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(asset.period_balance || asset.balance)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="section-total">
            <div className="total-label">Total Assets</div>
            <div className="total-amount amount-positive">
              {formatCurrency(balanceSheet.totalAssets)}
            </div>
          </div>
        </div>

        {/* Liabilities & Capital Section */}
        <div className="liabilities-equity-section">
          <div className="liabilities report-section">
            <h3>Liabilities</h3>
            {balanceSheet.liabilities.length === 0 ? (
              <div className="no-accounts">
                <p>No liability accounts found for this period</p>
              </div>
            ) : (
              <div className="accounts-list">
                {balanceSheet.liabilities.map(liability => (
                  <div key={liability.account_name} className="account-item">
                    <div className="account-name">{liability.account_name}</div>
                    <div className={`account-amount ${(liability.period_balance || liability.balance) >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                      {formatCurrency(liability.period_balance || liability.balance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="section-total">
              <div className="total-label">Total Liabilities</div>
              <div className="total-amount">
                {formatCurrency(balanceSheet.totalLiabilities)}
              </div>
            </div>
          </div>

          <div className="capital report-section">
            <h3>Capital</h3>
            {balanceSheet.capital.length === 0 ? (
              <div className="no-accounts">
                <p>No capital accounts found for this period</p>
              </div>
            ) : (
              <div className="accounts-list">
                {balanceSheet.capital.map(capital => (
                  <div key={capital.account_name} className="account-item">
                    <div className="account-name">{capital.account_name}</div>
                    <div className={`account-amount ${
                      // Check if this is the Drawings account
                      capital.account_name.toLowerCase().includes('drawings') 
                        ? 'amount-negative'  // Red color for drawings
                        : 'amount-positive'  // Green/black for other capital accounts
                    }`}>
                      {formatCurrency(capital.period_balance || capital.balance)}
                    </div>
                  </div>
                ))}
                
                {/* Net Income/Loss Line */}
                <div className="account-item net-income-line">
                  <div className="account-name">
                    {incomeStatement.netIncome >= 0 ? 'Add: Net Income' : 'Less: Net Loss'}
                  </div>
                  <div className={`account-amount ${incomeStatement.netIncome >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(incomeStatement.netIncome)}
                  </div>
                </div>
              </div>
            )}
            <div className="section-total">
              <div className="total-label">Total Capital</div>
              <div className="total-amount">
                {formatCurrency(totalCapitalWithNetIncome)}
              </div>
            </div>
          </div>
        </div>

        {/* Accounting Equation Check */}
        <div className={`balance-check ${isBalanced ? 'balanced' : 'not-balanced'}`}>
          <h3>Accounting Equation Check</h3>
          <div className="equation">
            <span className="equation-part">Assets: {formatCurrency(balanceSheet.totalAssets)}</span>
            <span className="equation-operator"> = </span>
            <span className="equation-part">Liabilities: {formatCurrency(balanceSheet.totalLiabilities)}</span>
            <span className="equation-operator"> + </span>
            <span className="equation-part">Capital: {formatCurrency(totalCapitalWithNetIncome)}</span>
          </div>
          <div className="equation-result">
            <div className={`result-status ${isBalanced ? 'balanced' : 'not-balanced'}`}>
              {isBalanced ? '✓ Equation Balanced' : '✗ Equation Not Balanced'}
            </div>
            {!isBalanced && (
              <div className="difference">
                Difference: {formatCurrency(Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + totalCapitalWithNetIncome)))}
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="financial-summary">
          <h4>Financial Summary</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Assets:</span>
              <span className="summary-value amount-positive">
                {formatCurrency(balanceSheet.totalAssets)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Liabilities:</span>
              <span className="summary-value">
                {formatCurrency(balanceSheet.totalLiabilities)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Base Capital:</span>
              <span className="summary-value">
                {formatCurrency(balanceSheet.totalCapital)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Net Income/Loss:</span>
              <span className={`summary-value ${incomeStatement.netIncome >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                {formatCurrency(incomeStatement.netIncome)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Capital:</span>
              <span className="summary-value">
                {formatCurrency(totalCapitalWithNetIncome)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Net Worth:</span>
              <span className={`summary-value ${balanceSheet.totalAssets - balanceSheet.totalLiabilities >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                {formatCurrency(balanceSheet.totalAssets - balanceSheet.totalLiabilities)}
              </span>
            </div>
          </div>
          
          {/* ✅ Report Timestamp Footer */}
          {reportGeneratedAt && (
            <div className="report-footer-timestamp">
              <small>
                ⏰ Report generated at: {reportGeneratedAt.fullDateTime} | 
                📍 Timezone: Pakistan (UTC+5)
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceSheet;