const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Behavior Service
 * 
 * Tracks user behavior patterns in Redis and calculates a
 * behavior score used to dynamically adjust rate limits.
 * 
 * Metrics tracked:
 * - Request rate (requests per minute)
 * - Failed login attempts
 * - Suspicious activity flags
 * - Spike detection
 * 
 * Score interpretation:
 * 1 = Normal usage
 * 2 = Mild suspicion (spike detected)
 * 3 = High suspicion (many failures)
 * 4+ = Severe (potential attack)
 */
class BehaviorService {
    constructor() {
        this.requestCountKey = (userId) => `behavior:requests:${userId}`;
        this.failedAttemptsKey = (userId) => `behavior:failures:${userId}`;
        this.behaviorDataKey = (userId) => `behavior:data:${userId}`;
        this.blockKey = (userId) => `block:${userId}`;
        this.spikeWindowSeconds = 60; // 1 minute window for spike detection
        this.spikeThreshold = 30; // More than 30 requests/minute = spike
        this.failureThreshold = 5; // More than 5 failures = suspicious
        this.blockDuration = 300; // Block for 5 minutes
    }

    /**
     * Record a request for behavior tracking
     */
    async recordRequest(userId) {
        const redis = getRedis();
        const key = this.requestCountKey(userId);
        const now = Date.now();

        try {
            // Use sorted set for time-windowed counting
            await redis.zadd(key, now, `${now}:${Math.random()}`);
            // Clean up old entries
            const cutoff = now - this.spikeWindowSeconds * 1000;
            await redis.zremrangebyscore(key, '-inf', cutoff);
            // Set expiry
            await redis.expire(key, this.spikeWindowSeconds * 2);
        } catch (error) {
            logger.error(`Behavior tracking error for user ${userId}:`, error.message);
        }
    }

    /**
     * Record a failed authentication attempt
     */
    async recordFailure(userId) {
        const redis = getRedis();
        const key = this.failedAttemptsKey(userId);

        try {
            const count = await redis.incr(key);
            await redis.expire(key, 3600); // Track failures for 1 hour

            // Auto-block if too many failures
            if (count >= this.failureThreshold * 2) {
                await this.blockUser(userId, this.blockDuration);
                logger.warn(`🚫 User ${userId} auto-blocked due to excessive failures (${count})`);
            }

            return count;
        } catch (error) {
            logger.error(`Failed attempt recording error:`, error.message);
            return 0;
        }
    }

    /**
     * Calculate the behavior score for a user
     * Lower score = better behavior, higher = more suspicious
     */
    async calculateBehaviorScore(userId) {
        const redis = getRedis();
        let score = 1;
        let details = {
            averageRequestRate: 0,
            recentSpikeDetected: false,
            failedAttempts: 0,
            behaviorScore: 1,
        };

        try {
            // Get request rate
            const requestKey = this.requestCountKey(userId);
            const now = Date.now();
            const cutoff = now - this.spikeWindowSeconds * 1000;
            await redis.zremrangebyscore(requestKey, '-inf', cutoff);
            const requestCount = await redis.zcard(requestKey);
            details.averageRequestRate = requestCount;

            // Check for spike
            if (requestCount > this.spikeThreshold) {
                score = Math.max(score, 2);
                details.recentSpikeDetected = true;
            }

            if (requestCount > this.spikeThreshold * 2) {
                score = Math.max(score, 3);
            }

            // Get failed attempts
            const failKey = this.failedAttemptsKey(userId);
            const failures = await redis.get(failKey);
            const failCount = failures ? parseInt(failures) : 0;
            details.failedAttempts = failCount;

            if (failCount >= this.failureThreshold) {
                score = Math.max(score, 3);
            }

            if (failCount >= this.failureThreshold * 2) {
                score = Math.max(score, 4);
            }

            details.behaviorScore = score;

            // Cache the behavior data
            await redis.set(
                this.behaviorDataKey(userId),
                JSON.stringify(details),
                'EX',
                300 // Cache for 5 minutes
            );

            return details;
        } catch (error) {
            logger.error(`Behavior score calculation error:`, error.message);
            return details;
        }
    }

    /**
     * Get cached behavior metrics for a user
     */
    async getBehaviorMetrics(userId) {
        const redis = getRedis();
        try {
            const cached = await redis.get(this.behaviorDataKey(userId));
            if (cached) {
                return JSON.parse(cached);
            }
            // Calculate fresh if no cache
            return this.calculateBehaviorScore(userId);
        } catch (error) {
            return {
                averageRequestRate: 0,
                recentSpikeDetected: false,
                failedAttempts: 0,
                behaviorScore: 1,
            };
        }
    }

    /**
     * Block a user temporarily
     */
    async blockUser(userId, durationSeconds = 300) {
        const redis = getRedis();
        try {
            await redis.set(this.blockKey(userId), 'blocked', 'EX', durationSeconds);
            logger.info(`🚫 User ${userId} blocked for ${durationSeconds} seconds`);
        } catch (error) {
            logger.error(`Block user error:`, error.message);
        }
    }

    /**
     * Unblock a user
     */
    async unblockUser(userId) {
        const redis = getRedis();
        try {
            await redis.del(this.blockKey(userId));
            // Reset failure count
            await redis.del(this.failedAttemptsKey(userId));
            logger.info(`✅ User ${userId} unblocked`);
        } catch (error) {
            logger.error(`Unblock user error:`, error.message);
        }
    }

    /**
     * Check if a user is blocked
     */
    async isBlocked(userId) {
        const redis = getRedis();
        try {
            const blocked = await redis.get(this.blockKey(userId));
            return blocked !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the list of currently blocked user IDs
     */
    async getBlockedUsers() {
        const redis = getRedis();
        try {
            const keys = await redis.keys('block:*');
            return keys.map((key) => key.replace('block:', ''));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get the list of users with suspicious behavior
     */
    async getSuspiciousUsers() {
        const redis = getRedis();
        try {
            const keys = await redis.keys('behavior:data:*');
            const suspicious = [];

            for (const key of keys) {
                const data = await redis.get(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed.behaviorScore >= 2) {
                        const userId = key.replace('behavior:data:', '');
                        suspicious.push({ userId, ...parsed });
                    }
                }
            }

            return suspicious;
        } catch (error) {
            return [];
        }
    }

    /**
     * Calculate effective rate limit based on role and behavior
     */
    getEffectiveLimit(baseLimit, behaviorScore) {
        if (baseLimit === -1) return -1; // Unlimited (admin)
        return Math.max(10, Math.floor(baseLimit / behaviorScore));
    }
}

// Singleton
const behaviorService = new BehaviorService();

module.exports = behaviorService;
