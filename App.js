import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AccountManagement from './components/AccountManagement';
import TransactionForm from './components/TransactionForm';
import BalanceSheet from './components/BalanceSheet';
import IncomeStatement from './components/IncomeStatement';
import TransactionHistory from './components/TransactionHistory';
import Ledgers from './components/Ledgers';
import Login from './components/LoginPage'; // Add Login import
import AuthService from './utils/auth'; // Add AuthService import
import './App.css';

// Navigation configuration - separates concerns
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard', component: Dashboard },
  { id: 'accounts', label: 'Account Management', icon: 'Folder', component: AccountManagement },
  { id: 'transaction', label: 'Record Transaction', icon: 'Plus', component: TransactionForm },
  { id: 'ledgers', label: 'Ledgers', icon: 'Book', component: Ledgers },
  { id: 'history', label: 'Transaction History', icon: 'Clipboard', component: TransactionHistory },
  { id: 'balance', label: 'Balance Sheet', icon: 'Chart', component: BalanceSheet },
  { id: 'income', label: 'Income Statement', icon: 'Money', component: IncomeStatement },
];

// Icons mapping for better maintainability
const ICON_MAP = {
  Dashboard: '📊',
  Folder: '📁',
  Plus: '➕',
  Book: '📚',
  Clipboard: '📋',
  Chart: '📈',
  Money: '💰',
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState(null); // Track user role

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = AuthService.isAuthenticated();
      setIsLoggedIn(authenticated);
      
      if (authenticated) {
        const user = AuthService.getUser();
        setUserRole(user?.role || null);
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // Memoize handlers to prevent unnecessary re-renders
  const handleTransactionAdded = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleNavClick = useCallback((tab) => {
    setActiveTab(tab);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setIsLoggedIn(true);
    const user = AuthService.getUser();
    setUserRole(user?.role || null);
  }, []);

  const handleLogout = useCallback(() => {
    AuthService.logout();
    setIsLoggedIn(false);
    setUserRole(null);
    setActiveTab('dashboard');
  }, []);

  // Memoize the active component to prevent unnecessary re-renders
  const ActiveComponent = useMemo(() => {
    const item = NAV_ITEMS.find(item => item.id === activeTab);
    return item ? item.component : Dashboard;
  }, [activeTab]);

  // Determine if mobile view
  const isMobile = window.innerWidth <= 768;

  // Show loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Filter navigation items based on user role
  const filteredNavItems = NAV_ITEMS;

  return (
    <div className="app-container">
      {/* Sidebar Component */}
      <aside 
        className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}
        aria-label="Main navigation"
        aria-hidden={isMobile && !isSidebarOpen}
      >
        <div className="sidebar-header">
          <h2>Accounting System</h2>
          <div className="user-info">
            <span className="user-role">
              {userRole === 'admin' ? '👑 Admin' : '👁️ Viewer'}
            </span>
          </div>
          {isMobile && (
            <button 
              className="close-sidebar"
              onClick={toggleSidebar}
              aria-label="Close sidebar"
            >
              ×
            </button>
          )}
        </div>
        
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              aria-label={item.label}
            >
              <span className="nav-icon" role="img" aria-hidden="true">
                {ICON_MAP[item.icon]}
              </span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
          
          {/* Logout button */}
          <button
            className="nav-item logout-nav-item"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <span className="nav-icon" role="img" aria-hidden="true">
              🚪
            </span>
            <span className="nav-text">Logout</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div className="credits">
            <p>Accounting Software</p>
            <p>Developed by Grotech Solutions</p>
            <p>© {new Date().getFullYear()} All rights reserved</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="mobile-header">
          <button 
            className="sidebar-toggle" 
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            aria-expanded={isSidebarOpen}
            aria-controls="sidebar-navigation"
          >
            ☰
          </button>
          <h1>{NAV_ITEMS.find(item => item.id === activeTab)?.label || 'Accounting System'}</h1>
        </header>

        <div className="content-area">
          {/* Render active component with appropriate props */}
          {activeTab === 'transaction' ? (
            <ActiveComponent onTransactionAdded={handleTransactionAdded} />
          ) : ['history', 'balance', 'income'].includes(activeTab) ? (
            <ActiveComponent key={refreshKey} />
          ) : (
            <ActiveComponent />
          )}
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {isMobile && isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default App;