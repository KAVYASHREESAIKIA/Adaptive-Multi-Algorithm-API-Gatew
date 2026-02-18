const circuitBreaker = require('../services/circuitBreaker');
const logger = require('../utils/logger');

/**
 * Circuit Breaker Middleware
 * 
 * Checks if the circuit is open before forwarding to backend.
 * If open, returns 503 immediately without attempting the request.
 */
const circuitBreakerMiddleware = (req, res, next) => {
    if (!circuitBreaker.canRequest()) {
        const status = circuitBreaker.getStatus();
        logger.warn('⚡ Circuit breaker OPEN — rejecting request to backend');

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
