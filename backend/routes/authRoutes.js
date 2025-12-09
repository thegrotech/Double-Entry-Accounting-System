const express = require('express');
const router = express.Router();
const UserModel = require('../models/userModel');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username and password'
      });
    }
    
    const result = await UserModel.login(username, password);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify token validity
// @access  Private (requires token in header)
router.get('/verify', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    const result = await UserModel.verifyToken(token);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Token verification error:', error.message);
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await UserModel.getUserById(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Get profile error:', error.message);
    
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error fetching profile'
    });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/users', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const result = await UserModel.getAllUsers();
    res.json(result);
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error fetching users'
    });
  }
});

// @route   POST /api/auth/users
// @desc    Create new user (admin only)
// @access  Private/Admin
router.post('/users', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Validate input
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username, password, and role'
      });
    }
    
    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "admin" or "viewer"'
      });
    }
    
    // Additional password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    const result = await UserModel.createUser(username, password, role);
    res.status(201).json(result);
  } catch (error) {
    console.error('Create user error:', error.message);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message || 'Error creating user'
    });
  }
});

// @route   PUT /api/auth/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put('/users/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    const updates = req.body;
    
    // Validate role if provided
    if (updates.role && !['admin', 'viewer'].includes(updates.role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "admin" or "viewer"'
      });
    }
    
    const result = await UserModel.updateUser(userId, updates);
    res.json(result);
  } catch (error) {
    console.error('Update user error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('already taken')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message || 'Error updating user'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change current user's password
// @access  Private
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide current and new password'
      });
    }
    
    // Password strength validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }
    
    const result = await UserModel.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );
    
    res.json(result);
  } catch (error) {
    console.error('Change password error:', error.message);
    
    if (error.message.includes('incorrect')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message || 'Error changing password'
    });
  }
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/users/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }
    
    const result = await UserModel.deleteUser(userId, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Delete user error:', error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message || 'Error deleting user'
    });
  }
});

// @route   GET /api/auth/check-admin
// @desc    Check if current user is admin
// @access  Private
router.get('/check-admin', authenticate, (req, res) => {
  res.json({
    success: true,
    isAdmin: req.user.role === 'admin',
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

// @route   GET /api/auth/stats
// @desc    Get user statistics (admin only)
// @access  Private/Admin
router.get('/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const result = await UserModel.getUserStats();
    res.json(result);
  } catch (error) {
    console.error('Get user stats error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error fetching user statistics'
    });
  }
});

// @route   GET /api/auth/check-username/:username
// @desc    Check if username is available
// @access  Public (for registration checks)
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }
    
    const result = await UserModel.usernameExists(username);
    res.json({
      success: true,
      available: !result.exists,
      username: username
    });
  } catch (error) {
    console.error('Check username error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error checking username availability'
    });
  }
});

module.exports = router;