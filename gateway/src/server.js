const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');
const meRoutes = require('./routes/meRoutes');

const app = express();

// ─────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
}));

// Trust proxy for real IP behind Docker/Nginx
app.set('trust proxy', true);

// ─────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'adaptive-api-gateway',
        instance: process.env.INSTANCE_ID || 'default',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────

// Auth routes (public — no authentication needed)
app.use('/auth', authRoutes);

// Admin routes (require admin JWT)
app.use('/admin', adminRoutes);

// User self-service routes (require JWT)
app.use('/me', meRoutes);

// Protected API routes (full middleware chain)
app.use('/api', apiRoutes);

// ─────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

// ─────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err.message);
    res.status(500).json({
        error: 'Internal Server Error',
        message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    });
});

// ─────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────
const startServer = async () => {
    try {
        // Connect to Redis
        connectRedis();
        logger.info('⏳ Connecting to Redis...');

        // Connect to PostgreSQL and sync models
        logger.info('⏳ Connecting to PostgreSQL...');
        await connectDatabase();

        // Start HTTP server
        const PORT = config.port;
        app.listen(PORT, '0.0.0.0', () => {
            const instanceId = process.env.INSTANCE_ID || 'default';
            logger.info(`\n${'═'.repeat(55)}`);
            logger.info(`  🚀 Adaptive API Gateway started`);
            logger.info(`  📡 Instance: ${instanceId}`);
            logger.info(`  🌐 Port: ${PORT}`);
            logger.info(`  🔧 Environment: ${config.nodeEnv}`);
            logger.info(`  📊 Default Algorithm: ${config.rateLimiting.defaultAlgorithm}`);
            logger.info(`${'═'.repeat(55)}\n`);
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();

module.exports = app;
