import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatCurrency } from '../utils/currencyFormatter';
import { getCurrentKarachiTime } from '../utils/timeFormatter';
import AuthService from '../utils/auth';

const IncomeStatement = () => {
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usePeriod, setUsePeriod] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState(null);
  
  // Get user role
  const isAdmin = AuthService.isAdmin();
  const userRole = AuthService.getRole();

  useEffect(() => {
    loadIncomeStatement();
    setReportGeneratedAt(getCurrentKarachiTime());
  }, []);

  const loadIncomeStatement = async (usePeriodFilter = false) => {
    try {
      setLoading(true);
      let response;
      
      if (usePeriodFilter && startDate && endDate) {
        setPeriodLoading(true);
        response = await accountingAPI.getIncomeStatementForPeriod(startDate, endDate);
      } else {
        response = await accountingAPI.getIncomeStatement();
      }
      
      setIncomeStatement(response.data);
      setReportGeneratedAt(getCurrentKarachiTime());
    } catch (error) {
      console.error('Error loading income statement:', error);
      alert('Error loading income statement: ' + error.message);
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

    loadIncomeStatement(true);
  };

  const handleResetPeriod = () => {
    setStartDate('');
    setEndDate('');
    setUsePeriod(false);
    loadIncomeStatement(false);
  };

  const handleUsePeriodToggle = (checked) => {
    setUsePeriod(checked);
    if (!checked) {
      handleResetPeriod();
    }
  };

  if (loading) {
    return (
      <div className="income-statement">
        <div className="loading">Loading income statement...</div>
      </div>
    );
  }

  if (!incomeStatement) {
    return (
      <div className="income-statement">
        <div className="no-data">No income statement data available.</div>
      </div>
    );
  }

  return (
    <div className="income-statement">
      <div className="report-header">
        {/* Role Indicator Header */}
        <div className="header-title-row">
          <h2>Income Statement</h2>
          <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
            {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
          </div>
        </div>
        
        {/* Viewer Mode Warning */}
        {!isAdmin && (
          <div className="viewer-warning">
            <p>
              ⚠️ <strong>View-Only Mode:</strong> You can explore all reports but cannot modify data.
            </p>
          </div>
        )}

        {/* Report Generation Timestamp */}
        {reportGeneratedAt && (
          <div className="report-timestamp">
            <small>
              ⏰ Report generated: {reportGeneratedAt.fullDateTime} | 📍 Timezone: Pakistan (UTC+5)
            </small>
          </div>
        )}
        
        {/* Date Range Selector - ENABLED FOR ALL USERS */}
        <div className="period-selector-card">
          <div className="period-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={usePeriod}
                onChange={(e) => handleUsePeriodToggle(e.target.checked)}
                className="toggle-checkbox"
              />
              <span className="toggle-text">Show Specific Period</span>
            </label>
            <small className="period-hint">
              Filter the report by date range to view specific time periods
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
        {incomeStatement.period && (
          <div className="period-info-card">
            <h3>Period: {incomeStatement.period.startDate} to {incomeStatement.period.endDate}</h3>
            <p>This report shows revenue and expenses for the selected period only.</p>
          </div>
        )}
        
        {!incomeStatement.period && (
          <div className="period-info-card">
            <h3>All Time Summary</h3>
            <p>This report shows lifetime revenue and expenses from all transactions.</p>
          </div>
        )}
      </div>

      {/* Revenue Section */}
      <div className="revenue-section report-section">
        <h3>Revenue</h3>
        {incomeStatement.revenue.length === 0 ? (
          <div className="no-accounts">
            <p>No revenue accounts found for this period</p>
          </div>
        ) : (
          <div className="accounts-list">
            {incomeStatement.revenue.map(item => (
              <div key={item.account_name} className="account-item">
                <div className="account-name">{item.account_name}</div>
                <div className="account-amount amount-positive">
                  {formatCurrency(item.period_balance || item.balance)}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="section-total">
          <div className="total-label">Total Revenue</div>
          <div className="total-amount">
            {formatCurrency(incomeStatement.totalRevenue)}
          </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="expenses-section report-section">
        <h3>Operating Expenses</h3>
        {incomeStatement.expenses.length === 0 ? (
          <div className="no-accounts">
            <p>No expense accounts found for this period</p>
          </div>
        ) : (
          <div className="accounts-list">
            {incomeStatement.expenses.map(item => (
              <div key={item.account_name} className="account-item">
                <div className="account-name">{item.account_name}</div>
                <div className="account-amount amount-negative">
                  {formatCurrency(item.period_balance || item.balance)}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="section-total">
          <div className="total-label">Total Expenses</div>
          <div className="total-amount">
            {formatCurrency(incomeStatement.totalExpenses)}
          </div>
        </div>
      </div>

      {/* Net Income Section */}
      <div className={`net-income-section ${incomeStatement.netIncome < 0 ? 'net-loss' : 'net-profit'}`}>
        <h3>Net Income</h3>
        <div className="net-income-total">
          <div className="total-label">Net Income</div>
          <div 
            className={`total-amount ${incomeStatement.netIncome >= 0 ? 'amount-positive' : 'amount-negative'}`}
          >
            {formatCurrency(incomeStatement.netIncome)}
          </div>
        </div>
        {incomeStatement.netIncome >= 0 ? (
          <p className="result-message positive">The business is profitable for this period.</p>
        ) : (
          <p className="result-message negative">The business incurred a loss for this period.</p>
        )}
      </div>

      {/* Report Summary */}
      <div className="report-summary">
        <h4>Report Summary</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Revenue Accounts:</span>
            <span className="summary-value">{incomeStatement.revenue.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Expense Accounts:</span>
            <span className="summary-value">{incomeStatement.expenses.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Profit Margin:</span>
            <span className={`summary-value ${incomeStatement.netIncome >= 0 ? 'positive' : 'negative'}`}>
              {incomeStatement.totalRevenue > 0 
                ? `${((incomeStatement.netIncome / incomeStatement.totalRevenue) * 100).toFixed(1)}%`
                : 'N/A'
              }
            </span>
          </div>
        </div>
        
        {/* Report Timestamp Footer */}
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
  );
};

export default IncomeStatement;