const { Op, fn, col } = require('sequelize');
const rateLimiterFactory = require('../services/rateLimiterFactory');
const behaviorService = require('../services/behaviorService');
const circuitBreaker = require('../services/circuitBreaker');
const { RequestLog, User } = require('../models');
const logger = require('../utils/logger');

// Consistency check
if (!RequestLog || !User) {
    logger.error('CRITICAL: Models (RequestLog/User) failed to load in adminController');
}

/**
 * POST /admin/algorithm
 */
const changeAlgorithm = async (req, res) => {
    try {
        const { algorithm } = req.body;
        if (!algorithm) return res.status(400).json({ error: 'Algorithm required' });

        const available = rateLimiterFactory.getAvailableAlgorithms();
        if (!available.includes(algorithm)) {
            return res.status(400).json({ error: 'Invalid algorithm' });
        }

        await rateLimiterFactory.setActiveAlgorithm(algorithm);
        return res.status(200).json({ activeAlgorithm: algorithm });
    } catch (error) {
        logger.error('Change algorithm error:', error.message);
        return res.status(500).json({ error: 'Failed to change algorithm' });
    }
};

/**
 * GET /admin/stats
 */
const getStats = async (req, res) => {
    try {
        const activeAlgorithm = await rateLimiterFactory.getActiveAlgorithm();
        const availableAlgorithms = rateLimiterFactory.getAvailableAlgorithms();
        const cbStatus = circuitBreaker.getStatus();

        const [totalRequests, blockedRequests, blockedUsers, suspiciousUsers] = await Promise.all([
            RequestLog.count(),
            RequestLog.count({ where: { status: 429 } }),
            behaviorService.getBlockedUsers(),
            behaviorService.getSuspiciousUsers()
        ]);

        const oneHourAgo = new Date(Date.now() - 3600000);
        const recentRequests = await RequestLog.count({
            where: { createdAt: { [Op.gte]: oneHourAgo } }
        });

        const userCounts = await User.findAll({
            attributes: ['role', [fn('COUNT', col('id')), 'count']],
            group: ['role'],
            raw: true
        });

        const statsData = {
            activeAlgorithm,
            availableAlgorithms,
            totalRequests,
            recentRequests,
            blockedRequests,
            blockedUsers: blockedUsers.length,
            suspiciousUsers: suspiciousUsers.length,
            userCounts,
            circuitBreaker: cbStatus,
            gatewayInstance: process.env.INSTANCE_ID || 'default'
        };

        logger.debug(`Stats data: ${JSON.stringify(statsData)}`);
        return res.status(200).json(statsData);
    } catch (error) {
        logger.error(`Get stats error: ${error.message}`);
        if (error.stack) logger.debug(error.stack);
        return res.status(500).json({
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};

/**
 * POST /admin/unblock/:userId
 * Unblock a user
 */
const unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'User ID is required',
            });
        }

        await behaviorService.unblockUser(userId);

        return res.status(200).json({
            message: `User ${userId} unblocked successfully`,
        });
    } catch (error) {
        logger.error('Unblock user error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to unblock user',
        });
    }
};

/**
 * GET /admin/behavior/:userId
 * Get behavior metrics for a specific user
 */
const getUserBehavior = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'User ID is required',
            });
        }

        const metrics = await behaviorService.getBehaviorMetrics(userId);
        const isBlocked = await behaviorService.isBlocked(userId);

        return res.status(200).json({
            userId,
            isBlocked,
            ...metrics,
        });
    } catch (error) {
        logger.error('Get user behavior error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch behavior metrics',
        });
    }
};

/**
 * POST /admin/circuit-breaker/reset
 * Manually reset the circuit breaker
 */
const resetCircuitBreaker = async (req, res) => {
    try {
        circuitBreaker.reset();

        return res.status(200).json({
            message: 'Circuit breaker reset successfully',
            status: circuitBreaker.getStatus(),
        });
    } catch (error) {
        logger.error('Circuit breaker reset error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reset circuit breaker',
        });
    }
};

/**
 * GET /admin/circuit-breaker/status
 * Get circuit breaker status
 */
const getCircuitBreakerStatus = async (req, res) => {
    try {
        return res.status(200).json({
            circuitBreaker: circuitBreaker.getStatus(),
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch circuit breaker status',
        });
    }
};

/**
 * GET /admin/logs
 * Get recent request logs
 */
const getLogs = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const logs = await RequestLog.findAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            include: [{
                model: User,
                attributes: ['email', 'role'],
                as: 'user'
            }]
        });

        return res.status(200).json({ logs });
    } catch (error) {
        logger.error('Get logs error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch logs',
        });
    }
};

module.exports = {
    changeAlgorithm,
    getStats,
    unblockUser,
    getUserBehavior,
    resetCircuitBreaker,
    getCircuitBreakerStatus,
    getLogs,
};
