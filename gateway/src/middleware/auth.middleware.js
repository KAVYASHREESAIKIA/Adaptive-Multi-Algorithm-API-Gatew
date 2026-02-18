const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const behaviorService = require('../services/behaviorService');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * 
 * Two-factor validation:
 * 1. JWT Bearer token verification
 * 2. API key validation
 * 
 * Attaches user object to req.user on success
 */

/**
 * Verify JWT token and API key
 */
const authenticate = async (req, res, next) => {
    try {
        // --- Step 1: Extract and verify JWT ---
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('401: Missing or invalid Authorization header');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
            });
        }

        const token = authHeader.split(' ')[1];
        let decoded;

        try {
            decoded = jwt.verify(token, config.jwt.accessSecret);
        } catch (jwtError) {
            logger.warn(`401: JWT Verification failed: ${jwtError.message}`);
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Access token expired. Use /auth/refresh to get a new token.',
                });
            }
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token',
            });
        }

        // --- Step 2: Verify API key ---
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            logger.warn('401: Missing x-api-key header');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing x-api-key header',
            });
        }

        // --- Step 3: Fetch user from DB and validate ---
        const user = await User.findByPk(decoded.userId);

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found',
            });
        }

        if (user.api_key !== apiKey) {
            // Record failed attempt
            await behaviorService.recordFailure(user.id);
            logger.warn(`401: Invalid API key for user ${user.id}`);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid API key',
            });
        }

        // --- Step 4: Check if user is blocked ---
        const isBlocked = await behaviorService.isBlocked(user.id);
        if (isBlocked) {
            logger.warn(`403: Blocked user ${user.id} attempted access`);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Your account has been temporarily blocked due to suspicious activity',
            });
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            apiKey: user.api_key,
        };

        next();
    } catch (error) {
        logger.error('Authentication error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication failed due to server error',
        });
    }
};

/**
 * Admin-only access middleware
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== config.roles.ADMIN) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required',
        });
    }
    next();
};

module.exports = { authenticate, requireAdmin };
