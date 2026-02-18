const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const behaviorService = require('../services/behaviorService');
const logger = require('../utils/logger');

/**
 * Generate a random API key
 */
const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'agw_'; // prefix for identification
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
};

/**
 * Generate access and refresh tokens
 */
const generateTokens = (userId, role) => {
    const accessToken = jwt.sign(
        { userId, role },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpiry }
    );

    const refreshToken = jwt.sign(
        { userId, role, type: 'refresh' },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiry }
    );

    return { accessToken, refreshToken };
};

/**
 * POST /auth/register
 * Register a new user
 */
const register = async (req, res) => {
    try {
        const { email, password, role = 'free' } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email and password are required',
            });
        }

        if (!['free', 'premium', 'admin'].includes(role)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid role. Valid options: free, premium, admin',
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'User with this email already exists',
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate API key
        const apiKey = generateApiKey();

        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            role,
            api_key: apiKey,
        });

        logger.info(`✅ User registered: ${email} (role: ${role})`);

        return res.status(201).json({
            message: 'User registered successfully',
            apiKey,
            userId: user.id,
            role: user.role,
        });
    } catch (error) {
        logger.error('Registration error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Registration failed',
        });
    }
};

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Email and password are required',
            });
        }

        // Find user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials',
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Record failed attempt
            await behaviorService.recordFailure(user.id);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials',
            });
        }

        // Check if blocked
        const isBlocked = await behaviorService.isBlocked(user.id);
        if (isBlocked) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Account temporarily blocked due to suspicious activity',
            });
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.role);

        // Store refresh token in DB
        const refreshExpiry = new Date();
        refreshExpiry.setDate(refreshExpiry.getDate() + 7); // 7 days

        await RefreshToken.create({
            user_id: user.id,
            token: refreshToken,
            expires_at: refreshExpiry,
        });

        logger.info(`✅ User logged in: ${email}`);

        return res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            apiKey: user.api_key,
            role: user.role,
            expiresIn: config.jwt.accessExpiry,
        });
    } catch (error) {
        logger.error('Login error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Login failed',
        });
    }
};

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Refresh token is required',
            });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
        } catch (jwtError) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired refresh token',
            });
        }

        // Check if refresh token exists in DB and is not revoked
        const storedToken = await RefreshToken.findOne({
            where: { token: refreshToken, revoked: false },
        });

        if (!storedToken) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Refresh token not found or has been revoked',
            });
        }

        // Check expiry
        if (new Date() > storedToken.expires_at) {
            await storedToken.update({ revoked: true });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Refresh token has expired',
            });
        }

        // Get user
        const user = await User.findByPk(decoded.userId);
        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found',
            });
        }

        // Revoke old refresh token
        await storedToken.update({ revoked: true });

        // Generate new tokens
        const tokens = generateTokens(user.id, user.role);

        // Store new refresh token
        const refreshExpiry = new Date();
        refreshExpiry.setDate(refreshExpiry.getDate() + 7);

        await RefreshToken.create({
            user_id: user.id,
            token: tokens.refreshToken,
            expires_at: refreshExpiry,
        });

        logger.info(`🔄 Token refreshed for user: ${user.email}`);

        return res.status(200).json({
            message: 'Token refreshed successfully',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: config.jwt.accessExpiry,
        });
    } catch (error) {
        logger.error('Token refresh error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Token refresh failed',
        });
    }
};

/**
 * POST /auth/logout
 * Revoke refresh token
 */
const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await RefreshToken.update(
                { revoked: true },
                { where: { token: refreshToken } }
            );
        }

        return res.status(200).json({
            message: 'Logged out successfully',
        });
    } catch (error) {
        logger.error('Logout error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Logout failed',
        });
    }
};

module.exports = { register, login, refreshAccessToken, logout };
