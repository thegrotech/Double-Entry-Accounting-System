// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../utils/api';
import { formatCurrency } from '../utils/currencyFormatter';
import { getCurrentKarachiTime } from '../utils/timeFormatter';
import AuthService from '../utils/auth';

const Dashboard = () => {
  const [balanceSheet, setBalanceSheet] = useState(null);
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
    loadReports();
    setReportGeneratedAt(getCurrentKarachiTime());
  }, []);

  const loadReports = async (usePeriodFilter = false) => {
    try {
      setLoading(true);
      let bsData, isData;

      if (usePeriodFilter && startDate && endDate) {
        setPeriodLoading(true);
        bsData = await accountingAPI.getBalanceSheetForPeriod(startDate, endDate);
        isData = await accountingAPI.getIncomeStatementForPeriod(startDate, endDate);
      } else {
        bsData = await accountingAPI.getBalanceSheet();
        isData = await accountingAPI.getIncomeStatement();
      }

      // Extract data from response
      setBalanceSheet(bsData.data);
      setIncomeStatement(isData.data);
      setReportGeneratedAt(getCurrentKarachiTime());
    } catch (err) {
      console.error('Dashboard load error:', err);
      alert('Failed to load dashboard data: ' + (err.message || 'Check console for details'));
    } finally {
      setLoading(false);
      setPeriodLoading(false);
    }
  };

  const handleApplyPeriod = (e) => {
    e.preventDefault();
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(startDate) || !regex.test(endDate)) {
      alert('Please use dd/mm/yyyy format');
      return;
    }

    const [d1, m1, y1] = startDate.split('/');
    const [d2, m2, y2] = endDate.split('/');
    const start = new Date(`${y1}-${m1}-${d1}`);
    const end = new Date(`${y2}-${m2}-${d2}`);

    if (start > end) {
      alert('Start date cannot be after end date');
      return;
    }

    loadReports(true);
  };

  const resetPeriod = () => {
    setStartDate('');
    setEndDate('');
    setUsePeriod(false);
    loadReports(false);
  };

  const totalEquity = () => {
    if (!balanceSheet || !incomeStatement) return 0;
    return (balanceSheet.totalCapital || 0) + (incomeStatement.netIncome || 0);
  };

  // Quick navigation function
  const goTo = (tab) => {
    // Prevent navigation for viewers on write operations
    if (!isAdmin && (tab === 'Record Transaction' || tab === 'Create Account')) {
      alert('⚠️ Admin privileges required for this action');
      return;
    }
    
    // Find the exact sidebar button by its text
    const buttons = document.querySelectorAll('.nav-text');
    const target = Array.from(buttons).find(btn => 
      btn.textContent.trim() === tab
    );
    if (target) {
      target.parentElement.click();
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div style={{ textAlign: 'center', padding: '4rem', fontSize: '1.2rem' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="report-header">
        <div className="header-title-row">
          <h2>Accounting Dashboard</h2>
          <div className={`role-badge ${isAdmin ? 'role-admin' : 'role-viewer'}`}>
            {isAdmin ? '🔑 Admin Mode' : '👁️ Viewer Mode'}
          </div>
        </div>

        {reportGeneratedAt && (
          <div className="report-timestamp">
            Report generated: {reportGeneratedAt.fullDateTime} | Timezone: Pakistan (UTC+5)
          </div>
        )}

        {/* Role Info Message for Viewers */}
        {!isAdmin && (
          <div className="viewer-warning">
            <p>
              ⚠️ <strong>Viewer Mode:</strong> You can explore all features and use date filters 
              but cannot create, edit, or delete data. Contact an administrator for write access.
            </p>
          </div>
        )}

        {/* Date Filter - ENABLED FOR ALL USERS */}
        <div className="period-selector-card">
          <div className="period-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={usePeriod}
                onChange={(e) => setUsePeriod(e.target.checked)}
                className="toggle-checkbox"
              />
              <span className="toggle-text">Filter by Date Range</span>
            </label>
            <small className="period-hint">
              Both admins and viewers can filter by date range to view specific time periods
            </small>
          </div>

          {usePeriod && (
            <form onSubmit={handleApplyPeriod} className="period-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Date</label>
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
                  <label className="form-label">To Date</label>
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
                  title="Apply the selected date filter"
                >
                  {periodLoading ? 'Loading...' : 'Apply'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={resetPeriod}
                  title="Reset to all-time view"
                >
                  All Time
                </button>
              </div>
            </form>
          )}
        </div>

        {usePeriod && incomeStatement?.period && (
          <div className="period-info-card">
            <h3>
              Period: {incomeStatement.period.startDate} to {incomeStatement.period.endDate}
            </h3>
          </div>
        )}
      </div>

      {/* Financial Metrics */}
      <div className="financial-metrics">
        <h3>Key Financial Metrics</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Net Income / (Loss)</span>
            <span className={`summary-value ${incomeStatement?.netIncome >= 0 ? 'amount-positive' : 'amount-negative'}`}>
              {formatCurrency(incomeStatement?.netIncome || 0)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Revenue (Sales)</span>
            <span className="summary-value amount-positive">
              {formatCurrency(incomeStatement?.totalRevenue || 0)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Expenses</span>
            <span className="summary-value amount-negative">
              {formatCurrency(incomeStatement?.totalExpenses || 0)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Assets</span>
            <span className="summary-value amount-positive">
              {formatCurrency(balanceSheet?.totalAssets || 0)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Liabilities</span>
            <span className="summary-value">
              {formatCurrency(balanceSheet?.totalLiabilities || 0)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Capital / Equity</span>
            <span className="summary-value">
              {formatCurrency(totalEquity())}
            </span>
          </div>
        </div>
      </div>

      {/* QUICK ACTION BUTTONS */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <button 
            className={`btn ${isAdmin ? 'btn-primary' : 'btn-disabled'}`}
            onClick={() => goTo('Record Transaction')}
            disabled={!isAdmin}
            title={!isAdmin ? "Admin privileges required to record transactions" : "Record a new transaction"}
          >
            Record Transaction
          </button>
          <button 
            className={`btn ${isAdmin ? 'btn-primary' : 'btn-disabled'}`}
            onClick={() => goTo('Account Management')}
            disabled={!isAdmin}
            title={!isAdmin ? "Admin privileges required to manage accounts" : "Create or manage accounts"}
          >
            Create Account
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => goTo('Income Statement')}
            title="View Income Statement report"
          >
            Income Statement
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => goTo('Balance Sheet')}
            title="View Balance Sheet report"
          >
            Balance Sheet
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => goTo('Transaction History')}
            title="View all transactions"
          >
            Transaction History
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => goTo('Ledgers')}
            title="View account ledgers"
          >
            View Ledgers
          </button>
        </div>
      </div>

      <div className="report-footer-timestamp">
        Dashboard generated at: {reportGeneratedAt?.fullDateTime || getCurrentKarachiTime().fullDateTime} | Timezone: Pakistan (UTC+5)
      </div>
    </div>
  );
};

export default Dashboard;