const TokenBucket = require('./tokenBucket');
const SlidingWindow = require('./slidingWindow');
const FixedWindow = require('./fixedWindow');
const { getRedis } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Rate Limiter Factory — Strategy Pattern
 * 
 * Manages the active rate limiting algorithm and provides
 * a unified interface for switching between algorithms at runtime.
 * 
 * The active algorithm is stored in Redis so all distributed
 * gateway instances use the same algorithm.
 */
class RateLimiterFactory {
    constructor() {
        this.algorithms = {
            token_bucket: new TokenBucket(),
            sliding_window: new SlidingWindow(),
            fixed_window: new FixedWindow(),
        };
        this.redisKey = 'gateway:active_algorithm';
    }

    /**
     * Get the currently active algorithm from Redis (shared state)
     * Falls back to config default if Redis is unavailable
     */
    async getActiveAlgorithm() {
        try {
            const redis = getRedis();
            const active = await redis.get(this.redisKey);
            return active || config.rateLimiting.defaultAlgorithm;
        } catch (error) {
            logger.warn('Could not fetch active algorithm from Redis, using default');
            return config.rateLimiting.defaultAlgorithm;
        }
    }

    /**
     * Set the active algorithm (stored in Redis for all instances)
     */
    async setActiveAlgorithm(algorithmName) {
        if (!this.algorithms[algorithmName]) {
            throw new Error(
                `Invalid algorithm: ${algorithmName}. Valid options: ${Object.keys(this.algorithms).join(', ')}`
            );
        }

        const redis = getRedis();
        await redis.set(this.redisKey, algorithmName);
        logger.info(`🔄 Active rate limiting algorithm changed to: ${algorithmName}`);
        return algorithmName;
    }

    /**
     * Get the rate limiter instance for the active algorithm
     */
    async getRateLimiter() {
        const algorithmName = await this.getActiveAlgorithm();
        return this.algorithms[algorithmName];
    }

    /**
     * Check if a request is allowed using the active algorithm
     */
    async allowRequest(userId, effectiveLimit) {
        const limiter = await this.getRateLimiter();
        return limiter.allowRequest(userId, effectiveLimit);
    }

    /**
     * Get rate limit status for a user
     */
    async getStatus(userId, effectiveLimit) {
        const limiter = await this.getRateLimiter();
        return limiter.getStatus(userId, effectiveLimit);
    }

    /**
     * Get all available algorithm names
     */
    getAvailableAlgorithms() {
        return Object.keys(this.algorithms);
    }
}

// Singleton instance
const rateLimiterFactory = new RateLimiterFactory();

module.exports = rateLimiterFactory;
