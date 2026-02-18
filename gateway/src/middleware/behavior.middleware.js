const behaviorService = require('../services/behaviorService');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Behavior Analysis Middleware
 * 
 * Runs after authentication, before rate limiting.
 * 
 * Steps:
 * 1. Record the request for behavior tracking
 * 2. Calculate behavior score
 * 3. Determine base limit by role
 * 4. Calculate effective limit (baseLimit / behaviorScore)
 * 5. Attach effectiveLimit to request for rate limiter
 */
const behaviorAnalyzer = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        // Step 1: Record this request
        await behaviorService.recordRequest(userId);

        // Step 2: Calculate behavior score
        const behavior = await behaviorService.calculateBehaviorScore(userId);

        // Step 3: Determine base limit by role
        let baseLimit;
        switch (role) {
            case config.roles.ADMIN:
                baseLimit = -1; // Unlimited
                break;
            case config.roles.PREMIUM:
                baseLimit = config.rateLimiting.premiumTierLimit;
                break;
            case config.roles.FREE:
            default:
                baseLimit = config.rateLimiting.freeTierLimit;
                break;
        }

        // Step 4: Calculate effective limit
        const effectiveLimit = behaviorService.getEffectiveLimit(baseLimit, behavior.behaviorScore);

        // Step 5: Attach to request
        req.rateLimit = {
            baseLimit,
            effectiveLimit,
            behaviorScore: behavior.behaviorScore,
            behaviorDetails: behavior,
        };

        logger.debug(
            `User ${userId} [${role}] — Base: ${baseLimit}, Effective: ${effectiveLimit}, Behavior Score: ${behavior.behaviorScore}`
        );

        next();
    } catch (error) {
        logger.error('Behavior analysis error:', error.message);
        // Fail open — don't block if behavior analysis fails
        req.rateLimit = {
            baseLimit: config.rateLimiting.freeTierLimit,
            effectiveLimit: config.rateLimiting.freeTierLimit,
            behaviorScore: 1,
            behaviorDetails: {},
        };
        next();
    }
};

module.exports = { behaviorAnalyzer };
