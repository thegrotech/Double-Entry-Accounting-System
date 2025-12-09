// backend/models/userModel.js - PostgreSQL Version
const { query } = require('../database/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

class UserModel {
  // User login
  static async login(username, password) {
    try {
      // Find user by username - PostgreSQL uses $1, $2 parameter placeholders
      const result = await query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Invalid username or password');
      }
      
      const user = result.rows[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid username or password');
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' } // Increased expiry for better UX
      );
      
      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Verify token
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const result = await query(
        'SELECT id, username, role, is_active FROM users WHERE id = $1 AND is_active = true',
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      const user = result.rows[0];
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Token expired' };
      } else if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid token' };
      }
      console.error('Token verification error:', error);
      throw error;
    }
  }

  // Get all users (admin only)
  static async getAllUsers() {
    try {
      const result = await query(
        'SELECT id, username, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
      );
      return { success: true, users: result.rows };
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  // Get user by ID
  static async getUserById(id) {
    try {
      const result = await query(
        'SELECT id, username, role, is_active, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return { success: true, user: result.rows[0] };
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw error;
    }
  }

  // Create new user (admin only)
  static async createUser(username, password, role) {
    try {
      // Check if username already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('Username already exists');
      }
      
      // Validate role
      if (!['admin', 'viewer'].includes(role)) {
        throw new Error('Invalid role. Must be "admin" or "viewer"');
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Insert new user and return the created record
      const result = await query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
        [username, passwordHash, role]
      );
      
      return {
        success: true,
        user: result.rows[0]
      };
    } catch (error) {
      console.error('Create user error:', error);
      
      // Handle PostgreSQL unique constraint violation
      if (error.code === '23505') {
        throw new Error('Username already exists');
      }
      throw error;
    }
  }

  // Update user (admin only)
  static async updateUser(id, updates) {
    try {
      const { username, role, is_active } = updates;
      const updatesSet = [];
      const params = [];
      let paramCount = 1;
      
      if (username !== undefined) {
        // Check if new username is already taken by another user
        const existingUser = await query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, id]
        );
        
        if (existingUser.rows.length > 0) {
          throw new Error('Username already taken by another user');
        }
        
        updatesSet.push(`username = $${paramCount}`);
        params.push(username);
        paramCount++;
      }
      
      if (role !== undefined) {
        if (!['admin', 'viewer'].includes(role)) {
          throw new Error('Invalid role. Must be "admin" or "viewer"');
        }
        updatesSet.push(`role = $${paramCount}`);
        params.push(role);
        paramCount++;
      }
      
      if (is_active !== undefined) {
        updatesSet.push(`is_active = $${paramCount}`);
        params.push(is_active);
        paramCount++;
      }
      
      if (updatesSet.length === 0) {
        throw new Error('No updates provided');
      }
      
      params.push(id);
      
      const sql = `UPDATE users SET ${updatesSet.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      const result = await query(sql, params);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return { 
        success: true, 
        changes: result.rowCount,
        user: result.rows[0]
      };
    } catch (error) {
      console.error('Update user error:', error);
      
      // Handle PostgreSQL unique constraint violation
      if (error.code === '23505') {
        throw new Error('Username already taken by another user');
      }
      throw error;
    }
  }

  // Change password
  static async changePassword(id, currentPassword, newPassword) {
    try {
      // Get current user
      const result = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      
      // Update password and return updated record
      const updateResult = await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role',
        [newPasswordHash, id]
      );
      
      return { 
        success: true, 
        changes: updateResult.rowCount,
        user: updateResult.rows[0]
      };
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  // Delete user (admin only, cannot delete self)
  static async deleteUser(id, currentUserId) {
    try {
      if (id === currentUserId) {
        throw new Error('Cannot delete your own account');
      }
      
      // First, check if user exists
      const checkResult = await query(
        'SELECT id FROM users WHERE id = $1',
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      // Delete user
      const result = await query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );
      
      return { 
        success: true, 
        changes: result.rowCount 
      };
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  // Get user statistics (admin only) - NEW HELPER METHOD
  static async getUserStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN role = 'viewer' THEN 1 ELSE 0 END) as viewer_count,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_users,
          MIN(created_at) as first_user_date,
          MAX(created_at) as latest_user_date
        FROM users
      `);
      
      return { success: true, stats: result.rows[0] };
    } catch (error) {
      console.error('Get user stats error:', error);
      throw error;
    }
  }

  // Check if username exists - NEW HELPER METHOD
  static async usernameExists(username) {
    try {
      const result = await query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      return { exists: result.rows.length > 0 };
    } catch (error) {
      console.error('Username check error:', error);
      throw error;
    }
  }
}

module.exports = UserModel;