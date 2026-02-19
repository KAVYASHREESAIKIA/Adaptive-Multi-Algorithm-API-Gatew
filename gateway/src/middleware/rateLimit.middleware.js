const rateLimiterFactory = require('../services/rateLimiterFactory');
const { RequestLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Rate Limiting Middleware
 * 
 * Uses the currently active algorithm (set by admin or default)
 * and the effective limit calculated by the behavior analyzer.
 * 
 * Admin users (effectiveLimit === -1) bypass rate limiting.
 */
const rateLimitMiddleware = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { effectiveLimit } = req.rateLimit;
        const instanceId = process.env.INSTANCE_ID || 'default';

        // Admin bypass
        if (effectiveLimit === -1) {
            logger.debug(`Admin user ${userId} bypasses rate limiting`);
            return next();
        }

        // Apply active rate limiting algorithm
        const result = await rateLimiterFactory.allowRequest(userId, effectiveLimit);

        // Set rate limit headers
        const activeAlgorithm = await rateLimiterFactory.getActiveAlgorithm();
        res.set({
            'X-RateLimit-Limit': effectiveLimit,
            'X-RateLimit-Remaining': Math.max(0, result.remaining),
            'X-RateLimit-Algorithm': activeAlgorithm,
        });

        if (!result.allowed) {
            res.set('Retry-After', result.retryAfter);

            logger.warn(
                `🚫 Rate limit exceeded for user ${userId} (algorithm: ${activeAlgorithm}, limit: ${effectiveLimit})`
            );

            // Log the blocked request to DB
            try {
                await RequestLog.create({
                    user_id: userId,
                    endpoint: req.originalUrl,
                    method: req.method,
                    status: 429,
                    ip_address: req.ip,
                    response_time_ms: 0,
                    algorithm_used: activeAlgorithm,
                    gateway_instance: instanceId,
                });
            } catch (logError) {
                logger.error('Failed to log blocked request:', logError.message);
            }

            return res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Try again later.',
                retryAfter: result.retryAfter,
                algorithm: activeAlgorithm,
            });
        }

        // Store algorithm info for logging in proxy controller
        req.algorithmUsed = activeAlgorithm;

        next();
    } catch (error) {
        logger.error('Rate limiting error:', error.message);
        // Fail open
        next();
    }
};

module.exports = { rateLimitMiddleware };
