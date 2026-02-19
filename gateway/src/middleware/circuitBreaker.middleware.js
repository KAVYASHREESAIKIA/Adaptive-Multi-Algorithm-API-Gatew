const circuitBreaker = require('../services/circuitBreaker');
const { RequestLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Circuit Breaker Middleware
 * 
 * Checks if the circuit is open before forwarding to backend.
 * If open, returns 503 immediately without attempting the request.
 */
const circuitBreakerMiddleware = async (req, res, next) => {
    if (!circuitBreaker.canRequest()) {
        const status = circuitBreaker.getStatus();
        const instanceId = process.env.INSTANCE_ID || 'default';
        const userId = req.user ? req.user.id : null;

        logger.warn('⚡ Circuit breaker OPEN — rejecting request to backend');

        // Log the rejection to DB
        try {
            await RequestLog.create({
                user_id: userId,
                endpoint: req.originalUrl,
                method: req.method,
                status: 503,
                ip_address: req.ip,
                response_time_ms: 0,
                algorithm_used: 'none',
                gateway_instance: instanceId,
            });
        } catch (logError) {
            logger.error('Failed to log circuit block:', logError.message);
        }

        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Backend service is temporarily unavailable. Please try again later.',
            circuitBreaker: {
                state: status.state,
                nextRetryAt: status.nextAttemptTime,
            },
        });
    }

    next();
};

module.exports = { circuitBreakerMiddleware };
