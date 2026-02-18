require('dotenv').config();

module.exports = {
    port: process.env.GATEWAY_PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
        accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    },

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'gateway_db',
        user: process.env.DB_USER || 'gateway_user',
        password: process.env.DB_PASSWORD || 'gateway_password',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
    },

    backend: {
        url: process.env.BACKEND_URL || 'http://localhost:5000',
    },

    rateLimiting: {
        defaultAlgorithm: process.env.DEFAULT_ALGORITHM || 'token_bucket',
        freeTierLimit: parseInt(process.env.FREE_TIER_LIMIT) || 100,
        premiumTierLimit: parseInt(process.env.PREMIUM_TIER_LIMIT) || 1000,
    },

    circuitBreaker: {
        failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD) || 5,
        resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT) || 60000,
        halfOpenRequests: parseInt(process.env.CB_HALF_OPEN_REQUESTS) || 1,
    },

    roles: {
        FREE: 'free',
        PREMIUM: 'premium',
        ADMIN: 'admin',
    },
};
