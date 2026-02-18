const rateLimiterFactory = require('../services/rateLimiterFactory');
const behaviorService = require('../services/behaviorService');
const circuitBreaker = require('../services/circuitBreaker');
const { RequestLog, User } = require('../models');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * POST /admin/algorithm
 * Change the active rate limiting algorithm at runtime
 */
const changeAlgorithm = async (req, res) => {
    try {
        const { algorithm } = req.body;

        if (!algorithm) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Algorithm name is required',
            });
        }

        const available = rateLimiterFactory.getAvailableAlgorithms();
        if (!available.includes(algorithm)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Invalid algorithm: ${algorithm}. Valid options: ${available.join(', ')}`,
            });
        }

        await rateLimiterFactory.setActiveAlgorithm(algorithm);

        return res.status(200).json({
            message: 'Algorithm updated successfully',
            activeAlgorithm: algorithm,
            availableAlgorithms: available,
        });
    } catch (error) {
        logger.error('Change algorithm error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to change algorithm',
        });
    }
};

/**
 * GET /admin/stats
 * Get system-wide statistics
 */
const getStats = async (req, res) => {
    try {
        const activeAlgorithm = await rateLimiterFactory.getActiveAlgorithm();
        const blockedUsers = await behaviorService.getBlockedUsers();
        const suspiciousUsers = await behaviorService.getSuspiciousUsers();
        const cbStatus = circuitBreaker.getStatus();

        // Get total request count
        const totalRequests = await RequestLog.count();

        // Get recent request count (last hour)
        const oneHourAgo = new Date(Date.now() - 3600000);
        const recentRequests = await RequestLog.count({
            where: {
                created_at: {
                    [require('sequelize').Op.gte]: oneHourAgo,
                },
            },
        });

        // Get blocked request count
        const blockedRequests = await RequestLog.count({
            where: { status: 429 },
        });

        // Get user count by role
        const userCounts = await User.findAll({
            attributes: [
                'role',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
            ],
            group: ['role'],
            raw: true,
        });

        return res.status(200).json({
            activeAlgorithm,
            availableAlgorithms: rateLimiterFactory.getAvailableAlgorithms(),
            totalRequests,
            recentRequests,
            blockedRequests,
            blockedUsers: blockedUsers.length,
            blockedUserIds: blockedUsers,
            suspiciousUsers: suspiciousUsers.length,
            suspiciousUserDetails: suspiciousUsers,
            userCounts,
            circuitBreaker: cbStatus,
            gatewayInstance: process.env.INSTANCE_ID || 'default',
        });
    } catch (error) {
        logger.error('Get stats error:', error.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch stats',
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
            order: [['created_at', 'DESC']],
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
