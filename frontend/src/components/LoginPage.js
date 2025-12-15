import React, { useState, useEffect } from 'react';
import AuthService from '../utils/auth';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Load saved username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // Handle lock countdown timer
  useEffect(() => {
    let timer;
    if (isLocked && lockTime > 0) {
      timer = setInterval(() => {
        setLockTime(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setLoginAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockTime]);

  // Input sanitization
  const sanitizeInput = (input) => {
    return input
      .trim()
      .replace(/[<>]/g, '') // Basic XSS protection
      .slice(0, 50); // Limit length
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFormErrors({});

    // Check if account is locked
    if (isLocked) {
      setError(`Account temporarily locked. Try again in ${lockTime} seconds`);
      return;
    }

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    
    try {
      // Sanitize inputs
      const sanitizedUsername = sanitizeInput(username);
      const sanitizedPassword = sanitizeInput(password);

      // Simulate network delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use AuthService.login() directly
      const result = await AuthService.login(sanitizedUsername, sanitizedPassword);
      
      // Save username if "Remember me" is checked
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', sanitizedUsername);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      // Reset login attempts on success
      setLoginAttempts(0);
      
      // If we get here, login was successful
      // Call the parent function to notify login success
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      // Increase login attempts
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      
      // Lock account after 3 failed attempts
      if (attempts >= 3) {
        setIsLocked(true);
        setLockTime(30); // 30 seconds lock
        setError('Too many failed attempts. Account locked for 30 seconds.');
      } else {
        setError(err.message || `Invalid username or password. ${3 - attempts} attempts remaining.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleDemoLogin = (demoUsername, demoPassword) => {
    setUsername(demoUsername);
    setPassword(demoPassword);
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
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}
          
          {isLocked && (
            <div className="error-message">
              <strong>🔒 Account Locked:</strong> Too many failed attempts. Please wait {lockTime} seconds.
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
                disabled={loading || isLocked}
                className={formErrors.username ? 'input-error' : ''}
                required
              />
              {formErrors.username && (
                <span className="field-error">{formErrors.username}</span>
              )}
            </div>
            
            <div className="form-group password-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading || isLocked}
                  className={formErrors.password ? 'input-error' : ''}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  disabled={loading || isLocked}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <span className="eye-icon">👁️</span>
                  ) : (
                    <span className="eye-icon">👁️‍🗨️</span>
                  )}
                </button>
              </div>
              {formErrors.password && (
                <span className="field-error">{formErrors.password}</span>
              )}
            </div>
            
            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span>Remember username</span>
              </label>
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={loading || isLocked}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
          
          {/* Quick Demo Buttons */}
          <div className="demo-logins">
            <p className="demo-title">Quick Demo:</p>
            <div className="demo-buttons">
              <button
                type="button"
                className="demo-button admin"
                onClick={() => handleDemoLogin('admin', 'admin123')}
                disabled={loading || isLocked}
              >
                Login as Admin
              </button>
              <button
                type="button"
                className="demo-button viewer"
                onClick={() => handleDemoLogin('viewer', 'viewer123')}
                disabled={loading || isLocked}
              >
                Login as Viewer
              </button>
            </div>
          </div>
          
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
              <p>Contact Administrator at +923180033899 if any error occur!</p>
              <small>Account locks for 30 seconds after 3 failed attempts</small>
            </div>
          </div>
        </div>
        
        <div className="login-footer">
          <p>Accounting System v1.1.0 • Role-Based Access Control</p>
          <p className="attempts-counter">
            Failed attempts: {loginAttempts}/3 {isLocked && `(Locked for ${lockTime}s)`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
