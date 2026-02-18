const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redis = null;

const connectRedis = () => {
    redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        retryStrategy: (times) => {
            const delay = Math.min(times * 500, 5000);
            logger.warn(`⏳ Redis reconnecting... attempt ${times}`);
            return delay;
        },
        maxRetriesPerRequest: null,
    });

    redis.on('connect', () => {
        logger.info('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
        logger.error('❌ Redis connection error:', err.message);
    });

    return redis;
};

const getRedis = () => {
    if (!redis) {
        return connectRedis();
    }
    return redis;
};

module.exports = { connectRedis, getRedis };
