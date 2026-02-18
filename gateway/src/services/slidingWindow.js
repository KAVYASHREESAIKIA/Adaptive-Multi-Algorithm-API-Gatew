const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Sliding Window Rate Limiting Algorithm
 * 
 * Concept:
 * - Uses a Redis sorted set to store timestamps of each request
 * - Window slides with current time
 * - Count requests within the last hour
 * - More accurate than fixed window, prevents boundary bursts
 * 
 * Redis Key: sw:{userId}
 * Value: Sorted set of request timestamps
 */
class SlidingWindow {
    constructor() {
        this.name = 'sliding_window';
        this.windowSize = 3600; // 1 hour in seconds
    }

    /**
     * Check if a request is allowed under the sliding window algorithm
     * @param {string} userId - The user's ID
     * @param {number} limit - Max requests per window
     * @returns {Object} { allowed, remaining, retryAfter }
     */
    async allowRequest(userId, limit) {
        const redis = getRedis();
        const key = `sw:${userId}`;
        const now = Date.now();
        const windowStart = now - this.windowSize * 1000;

        try {
            // Lua script for atomic sliding window check
            const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local windowStart = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local windowSize = tonumber(ARGV[4])

        -- Remove expired entries outside the window
        redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

        -- Count current requests in window
        local currentCount = redis.call('ZCARD', key)

        if currentCount < limit then
          -- Add new request timestamp
          redis.call('ZADD', key, now, now .. ':' .. math.random(100000))
          redis.call('EXPIRE', key, windowSize + 60)
          local remaining = limit - currentCount - 1
          return cjson.encode({allowed = true, remaining = remaining, retryAfter = 0})
        else
          -- Find the oldest entry to calculate retry time
          local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
          local retryAfter = 0
          if #oldest >= 2 then
            retryAfter = math.ceil((tonumber(oldest[2]) + windowSize * 1000 - now) / 1000)
            if retryAfter < 0 then retryAfter = 1 end
          end
          return cjson.encode({allowed = false, remaining = 0, retryAfter = retryAfter})
        end
      `;

            const result = await redis.eval(
                luaScript, 1, key, now, windowStart, limit, this.windowSize
            );
            const parsed = JSON.parse(result);

            return {
                allowed: parsed.allowed,
                remaining: parsed.remaining,
                retryAfter: parsed.retryAfter,
            };
        } catch (error) {
            logger.error(`Sliding Window error for user ${userId}:`, error.message);
            return { allowed: true, remaining: -1, retryAfter: 0 };
        }
    }

    /**
     * Get current status for a user
     */
    async getStatus(userId, limit) {
        const redis = getRedis();
        const key = `sw:${userId}`;
        const now = Date.now();
        const windowStart = now - this.windowSize * 1000;

        try {
            await redis.zremrangebyscore(key, '-inf', windowStart);
            const count = await redis.zcard(key);
            return {
                remaining: Math.max(0, limit - count),
                total: limit,
            };
        } catch (error) {
            return { remaining: -1, total: limit };
        }
    }
}

module.exports = SlidingWindow;
