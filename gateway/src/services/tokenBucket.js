const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Token Bucket Rate Limiting Algorithm
 * 
 * Concept:
 * - Each user has a bucket with a max capacity of tokens
 * - Tokens refill at a constant rate
 * - Each request consumes one token
 * - If no tokens left, request is rejected
 * 
 * Redis Key: tb:{userId}
 * Value: JSON { tokens, lastRefill }
 */
class TokenBucket {
    constructor() {
        this.name = 'token_bucket';
    }

    /**
     * Check if a request is allowed under the token bucket algorithm
     * @param {string} userId - The user's ID
     * @param {number} limit - Max tokens (effective limit per hour)
     * @returns {Object} { allowed, remaining, retryAfter }
     */
    async allowRequest(userId, limit) {
        const redis = getRedis();
        const key = `tb:${userId}`;
        const now = Date.now();
        const refillRate = limit / 3600; // tokens per second (limit per hour)

        try {
            // Use Lua script for atomicity across distributed instances
            const luaScript = `
        local key = KEYS[1]
        local maxTokens = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])

        local data = redis.call('GET', key)
        local tokens, lastRefill

        if data then
          local decoded = cjson.decode(data)
          tokens = tonumber(decoded.tokens)
          lastRefill = tonumber(decoded.lastRefill)
        else
          tokens = maxTokens
          lastRefill = now
        end

        -- Calculate tokens to add based on elapsed time
        local elapsed = (now - lastRefill) / 1000
        local newTokens = elapsed * refillRate
        tokens = math.min(maxTokens, tokens + newTokens)
        lastRefill = now

        -- Try to consume a token
        if tokens >= 1 then
          tokens = tokens - 1
          local payload = cjson.encode({tokens = tokens, lastRefill = lastRefill})
          redis.call('SET', key, payload, 'EX', 7200)
          return cjson.encode({allowed = true, remaining = math.floor(tokens), retryAfter = 0})
        else
          -- Calculate when next token will be available
          local retryAfter = math.ceil((1 - tokens) / refillRate)
          local payload = cjson.encode({tokens = tokens, lastRefill = lastRefill})
          redis.call('SET', key, payload, 'EX', 7200)
          return cjson.encode({allowed = false, remaining = 0, retryAfter = retryAfter})
        end
      `;

            const result = await redis.eval(luaScript, 1, key, limit, refillRate, now);
            const parsed = JSON.parse(result);

            return {
                allowed: parsed.allowed,
                remaining: parsed.remaining,
                retryAfter: parsed.retryAfter,
            };
        } catch (error) {
            logger.error(`Token Bucket error for user ${userId}:`, error.message);
            // Fail open — allow request if Redis is down
            return { allowed: true, remaining: -1, retryAfter: 0 };
        }
    }

    /**
     * Get current status for a user
     */
    async getStatus(userId, limit) {
        const redis = getRedis();
        const key = `tb:${userId}`;

        try {
            const data = await redis.get(key);
            if (!data) {
                return { remaining: limit, total: limit };
            }

            const { tokens, lastRefill } = JSON.parse(data);
            const now = Date.now();
            const refillRate = limit / 3600;
            const elapsed = (now - lastRefill) / 1000;
            const currentTokens = Math.min(limit, tokens + elapsed * refillRate);

            return {
                remaining: Math.floor(currentTokens),
                total: limit,
            };
        } catch (error) {
            return { remaining: -1, total: limit };
        }
    }
}

module.exports = TokenBucket;
