const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const rateLimiterFactory = require('../services/rateLimiterFactory');
const behaviorService = require('../services/behaviorService');
const config = require('../config');

/**
 * User-facing Routes (/me)
 * 
 * GET /me/rate-status  - Get current user's rate limit status
 * GET /me/profile      - Get current user profile
 */

router.use(authenticate);

/**
 * GET /me/rate-status
 * Returns the user's current rate limit status
 */
router.get('/rate-status', async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        // Get behavior metrics
        const behavior = await behaviorService.getBehaviorMetrics(userId);

        // Get base limit
        let baseLimit;
        switch (role) {
            case config.roles.ADMIN:
                baseLimit = -1;
                break;
            case config.roles.PREMIUM:
                baseLimit = config.rateLimiting.premiumTierLimit;
                break;
            default:
                baseLimit = config.rateLimiting.freeTierLimit;
        }

        // Calculate effective limit
        const effectiveLimit = behaviorService.getEffectiveLimit(baseLimit, behavior.behaviorScore);

        // Get current algorithm and remaining requests
        const activeAlgorithm = await rateLimiterFactory.getActiveAlgorithm();

        let remaining = effectiveLimit;
        if (effectiveLimit !== -1) {
            const status = await rateLimiterFactory.getStatus(userId, effectiveLimit);
            remaining = status.remaining;
        }

        return res.status(200).json({
            userId,
            role,
            activeAlgorithm,
            baseLimit: baseLimit === -1 ? 'unlimited' : baseLimit,
            effectiveLimit: effectiveLimit === -1 ? 'unlimited' : effectiveLimit,
            remainingRequests: remaining === -1 ? 'unlimited' : remaining,
            behaviorScore: behavior.behaviorScore,
            behaviorDetails: behavior,
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch rate limit status',
        });
    }
});

/**
 * GET /me/profile
 * Returns the current user's profile
 */
router.get('/profile', async (req, res) => {
    return res.status(200).json({
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
    });
});

module.exports = router;
