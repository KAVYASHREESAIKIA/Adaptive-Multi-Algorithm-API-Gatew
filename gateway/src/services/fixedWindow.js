const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Fixed Window Rate Limiting Algorithm
 * 
 * Concept:
 * - Divides time into fixed windows (e.g., 1 hour)
 * - Counts requests per window
 * - Simple and efficient
 * - Can allow bursts at window boundaries
 * 
 * Redis Key: fw:{userId}:{windowTimestamp}
 * Value: Request count
 */
class FixedWindow {
    constructor() {
        this.name = 'fixed_window';
        this.windowSize = 3600; // 1 hour in seconds
    }

    /**
     * Get the current window key
     */
    _getWindowKey(userId) {
        const windowTimestamp = Math.floor(Date.now() / (this.windowSize * 1000));
        return `fw:${userId}:${windowTimestamp}`;
    }

    /**
     * Check if a request is allowed under the fixed window algorithm
     * @param {string} userId - The user's ID
     * @param {number} limit - Max requests per window
     * @returns {Object} { allowed, remaining, retryAfter }
     */
    async allowRequest(userId, limit) {
        const redis = getRedis();
        const key = this._getWindowKey(userId);

        try {
            // Lua script for atomic increment and check
            const luaScript = `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local windowSize = tonumber(ARGV[2])

        local current = redis.call('GET', key)
        
        if current == false then
          -- First request in this window
          redis.call('SET', key, 1, 'EX', windowSize + 10)
          return cjson.encode({allowed = true, remaining = limit - 1, retryAfter = 0})
        end

        current = tonumber(current)

        if current < limit then
          redis.call('INCR', key)
          local remaining = limit - current - 1
          return cjson.encode({allowed = true, remaining = remaining, retryAfter = 0})
        else
          -- Get TTL for retry-after
          local ttl = redis.call('TTL', key)
          if ttl < 0 then ttl = 1 end
          return cjson.encode({allowed = false, remaining = 0, retryAfter = ttl})
        end
      `;

            const result = await redis.eval(luaScript, 1, key, limit, this.windowSize);
            const parsed = JSON.parse(result);

            return {
                allowed: parsed.allowed,
                remaining: parsed.remaining,
                retryAfter: parsed.retryAfter,
            };
        } catch (error) {
            logger.error(`Fixed Window error for user ${userId}:`, error.message);
            return { allowed: true, remaining: -1, retryAfter: 0 };
        }
    }

    /**
     * Get current status for a user
     */
    async getStatus(userId, limit) {
        const redis = getRedis();
        const key = this._getWindowKey(userId);

        try {
            const count = await redis.get(key);
            const used = count ? parseInt(count) : 0;
            return {
                remaining: Math.max(0, limit - used),
                total: limit,
            };
        } catch (error) {
            return { remaining: -1, total: limit };
        }
    }
}

module.exports = FixedWindow;
