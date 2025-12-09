import axios from 'axios';
import AuthService from './auth';

// Define the API base URL
const API_BASE = 'https://double-entry-accounting-system-backend.onrender.com/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Get token from AuthService
    const token = AuthService.getToken();
    
    // If token exists and we're not on a public endpoint, add it to headers
    if (token && !config.url.includes('/auth/login')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle consistent response format and auth errors
api.interceptors.response.use(
  (response) => {
    // Handle the new response format: { success: true, data: ... }
    if (response.data && response.data.success !== undefined) {
      // Return data directly if success is true
      if (response.data.success === true) {
        return {
          ...response,
          data: response.data.data || response.data
        };
      } else {
        // If success is false, throw an error
        const error = new Error(response.data.message || response.data.error || 'Request failed');
        error.response = response;
        throw error;
      }
    }
    // If no success field, assume old format and return as-is
    return response;
  },
  (error) => {
    console.error('API Error:', {
      message: error.message,
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      AuthService.logout();
      // Redirect to login page if we're in a browser environment
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    // Handle authorization errors
    if (error.response?.status === 403) {
      console.warn('Access denied. User lacks required permissions.');
    }
    
    // Format error for consistent handling
    const formattedError = new Error(
      error.response?.data?.message || 
      error.response?.data?.error || 
      error.message || 
      'Network error occurred'
    );
    formattedError.status = error.response?.status;
    formattedError.data = error.response?.data;
    
    return Promise.reject(formattedError);
  }
);

// Authentication API methods
export const authAPI = {
  // Login user
  login: (username, password) => 
    api.post('/auth/login', { username, password }),
  
  // Verify token
  verifyToken: () => api.get('/auth/verify'),
  
  // Get user profile
  getProfile: () => api.get('/auth/profile'),
  
  // Change password
  changePassword: (currentPassword, newPassword) => 
    api.put('/auth/change-password', { currentPassword, newPassword }),
  
  // Check if user is admin
  checkAdmin: () => api.get('/auth/check-admin'),
  
  // User management (admin only)
  getAllUsers: () => api.get('/auth/users'),
  getUserById: (id) => api.get(`/auth/users/${id}`),
  createUser: (userData) => api.post('/auth/users', userData),
  updateUser: (id, userData) => api.put(`/auth/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/auth/users/${id}`)
};

// Accounting API methods - UPDATED to match new routes
export const accountingAPI = {
  // ===== ACCOUNT MANAGEMENT =====
  
  // Get all accounts (flat list)
  getAccounts: () => api.get('/accounts'),
  
  // Get accounts hierarchy (for AccountManagement.js)
  getAccountsHierarchy: () => api.get('/accounts/hierarchy'),
  
  // Create new account
  createAccount: (accountData) => api.post('/accounts', accountData),
  
  // Update account
  updateAccount: (id, accountData) => api.put(`/accounts/${id}`, accountData),
  
  // Delete account
  deleteAccount: (id) => api.delete(`/accounts/${id}`),
  
  // Get account by ID
  getAccountById: (id) => api.get(`/accounts/${id}`),
  
  // Get accounts by type
  getAccountsByType: (type) => api.get(`/accounts/type/${type}`),
  
  // Get chart of accounts
  getChartOfAccounts: () => api.get('/chart-of-accounts'),
  
  // Check account usage
  getAccountUsage: (id) => api.get(`/accounts/${id}/usage`),
  
  // ===== TRANSACTION MANAGEMENT =====
  
  // Get all transactions
  getTransactions: () => api.get('/transactions'),
  
  // Create new transaction
  createTransaction: (transactionData) => api.post('/transactions', transactionData),
  
  // Get transaction by ID
  getTransactionById: (id) => api.get(`/transactions/${id}`),
  
  // Update transaction
  updateTransaction: (id, transactionData) => api.put(`/transactions/${id}`, transactionData),
  
  // Delete transaction
  deleteTransaction: (id) => api.delete(`/transactions/${id}`),
  
  // Get next transaction number
  getNextTransactionNumber: () => api.get('/transactions/next-number'),
  
  // Get transactions by date range
  getTransactionsByDateRange: (startDate, endDate) => 
    api.get(`/transactions/by-date-range?startDate=${startDate}&endDate=${endDate}`),
  
  // Get transactions by specific date
  getTransactionsByDate: (date) => api.get(`/transactions/by-date/${date}`),
  
  // Search transactions
  searchTransactions: (query) => api.get(`/transactions/search?q=${encodeURIComponent(query)}`),
  
  // ===== FINANCIAL REPORTS =====
  
  // Get balance sheet (all time)
  getBalanceSheet: () => api.get('/reports/balance-sheet'),
  
  // Get balance sheet for specific period
  getBalanceSheetForPeriod: (startDate, endDate) => 
    api.get(`/reports/balance-sheet/period?startDate=${startDate}&endDate=${endDate}`),
  
  // Get income statement (all time)
  getIncomeStatement: () => api.get('/reports/income-statement'),
  
  // Get income statement for specific period
  getIncomeStatementForPeriod: (startDate, endDate) => 
    api.get(`/reports/income-statement/period?startDate=${startDate}&endDate=${endDate}`),
  
  // Get financial ratios
  getFinancialRatios: () => api.get('/reports/financial-ratios'),
  
  // ===== LEDGER REPORTS =====
  
  // Get account ledger
  getAccountLedger: (accountId, startDate, endDate) => 
    api.get(`/reports/ledger/${accountId}?startDate=${startDate}&endDate=${endDate}`),
  
  // ===== SYSTEM HEALTH =====
  
  // Validate accounting equation
  validateAccountingEquation: () => api.get('/system/validate-equation'),
  
  // Get system statistics
  getSystemStats: () => api.get('/system/stats'),
  
  // Debug system
  debugSystem: () => api.get('/system/debug'),
  
  // ===== COMPANY CONFIGURATION =====
  
  // Get company details
  getCompanyDetails: () => api.get('/company-details'),
  
  // Update company details
  updateCompanyDetails: (companyData) => api.put('/company-details', companyData)
};

// Helper function to check if user can perform write operations
export const canUserWrite = () => {
  return AuthService.isAdmin();
};

// Helper function to check if user can perform delete operations
export const canUserDelete = () => {
  return AuthService.isAdmin();
};

// Helper function to check if user can access admin features
export const canUserAccessAdmin = () => {
  return AuthService.isAdmin();
};

// Helper function to get user role for display
export const getUserRoleDisplay = () => {
  const user = AuthService.getUser();
  if (!user) return 'Guest';
  
  return user.role === 'admin' ? '👑 Administrator' : '👁️ Viewer';
};

// Helper function to format date to dd/mm/yyyy
export const formatDateToDisplay = (dateString) => {
  if (!dateString) return '';
  
  // If already in dd/mm/yyyy format, return as-is
  if (dateString.includes('/')) {
    return dateString;
  }
  
  // If in yyyy-mm-dd format, convert to dd/mm/yyyy
  if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  
  // Try parsing as Date object
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (error) {
    console.error('Error formatting date:', error);
  }
  
  return dateString; // Return as-is if can't parse
};

// Helper function to format date to yyyy-mm-dd for API
export const formatDateForAPI = (dateString) => {
  if (!dateString) return '';
  
  // If in dd/mm/yyyy format, convert to yyyy-mm-dd
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  
  // If already in yyyy-mm-dd format, return as-is
  if (dateString.includes('-') && dateString.length === 10) {
    return dateString;
  }
  
  return dateString;
};

// Helper to validate dd/mm/yyyy format
export const isValidDate = (dateStr) => {
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
  
  // Check if date is valid
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
};

// REMOVE THIS LINE (line 328 from your original):
// export { api as default, authAPI, accountingAPI };

// Add this instead - export api as default:

export default api;
