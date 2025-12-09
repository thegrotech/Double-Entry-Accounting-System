const jwt = require('jsonwebtoken');
const { query } = require('../database/db'); // Changed: Import query, not db

// JWT secret - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'accounting-system-secret-key-change-in-production';

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. No token provided.' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access denied. Invalid token format.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists and is active
    // CHANGED: Use query() instead of getAsync, and PostgreSQL syntax
    const result = await query(
      'SELECT id, username, role, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    const user = result.rows[0]; // CHANGED: Access first row from result.rows

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found or account is inactive' 
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired. Please login again.' 
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token. Please login again.' 
      });
    } else {
      console.error('Authentication error:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error during authentication' 
      });
    }
  }
};

// Role-based authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    // Convert single role to array if needed
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Convenience middlewares
const authorizeAdmin = authorize(['admin']);
const authorizeViewer = authorize(['viewer']);

module.exports = { 
  authenticate, 
  authorize, 
  authorizeAdmin, 
  authorizeViewer,
  JWT_SECRET 
};