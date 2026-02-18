const express = require('express');
const router = express.Router();
const {
    register,
    login,
    refreshAccessToken,
    logout,
} = require('../controllers/authController');

/**
 * Authentication Routes
 * 
 * POST /auth/register  - Register a new user
 * POST /auth/login     - Login and get tokens
 * POST /auth/refresh   - Refresh access token
 * POST /auth/logout    - Revoke refresh token
 */

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

module.exports = router;
