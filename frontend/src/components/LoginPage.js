import React, { useState } from 'react';
import AuthService from '../utils/auth'; // Use AuthService directly
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }
    
    try {
      // Use AuthService.login() directly
      const result = await AuthService.login(username, password);
      
      // If we get here, login was successful
      // Call the parent function to notify login success
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Accounting System</h2>
          <p>Role-Based Access Control</p>
        </div>
        
        <div className="login-form-container">
          <h3>Login to Your Account</h3>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="login-info">
            <h4>Default Login Credentials:</h4>
            <div className="credentials">
              <div className="credential-item">
                <strong>👑 Administrator:</strong>
                <div>Username: <code>admin</code></div>
                <div>Password: <code>admin123</code></div>
                <small>Full access to all features</small>
              </div>
              
              <div className="credential-item">
                <strong>👁️ Viewer:</strong>
                <div>Username: <code>viewer</code></div>
                <div>Password: <code>viewer123</code></div>
                <small>Read-only access (no modifications)</small>
              </div>
            </div>
            
            <div className="security-notice">
              <strong>⚠️ Security Notice:</strong>
              <p>Change default passwords immediately after first login!</p>
            </div>
          </div>
        </div>
        
        <div className="login-footer">
          <p>Accounting System v1.1.0 • Role-Based Access Control</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
