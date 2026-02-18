const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// ─────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'backend-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─────────────────────────────────────────
// Internal Endpoints (called by Gateway)
// ─────────────────────────────────────────

/**
 * GET /internal/data
 * Returns protected resource content
 * Gateway maps /api/data → /internal/data
 */
app.get('/internal/data', (req, res) => {
    const userId = req.headers['x-user-id'] || 'unknown';
    const userRole = req.headers['x-user-role'] || 'unknown';
    const gatewayInstance = req.headers['x-gateway-instance'] || 'unknown';

    res.status(200).json({
        data: 'Protected resource content',
        message: 'Successfully accessed protected data through the API Gateway',
        metadata: {
            userId,
            userRole,
            servedBy: 'backend-service',
            gatewayInstance,
            timestamp: new Date().toISOString(),
        },
    });
});

/**
 * POST /internal/resource
 * Create a resource
 * Gateway maps /api/resource → /internal/resource
 */
app.post('/internal/resource', (req, res) => {
    const { name } = req.body;
    const userId = req.headers['x-user-id'] || 'unknown';

    if (!name) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Resource name is required',
        });
    }

    res.status(201).json({
        message: 'Resource created successfully',
        resource: {
            id: `res_${Date.now()}`,
            name,
            createdBy: userId,
            createdAt: new Date().toISOString(),
        },
    });
});

/**
 * GET /internal/users
 * List users (sample)
 */
app.get('/internal/users', (req, res) => {
    res.status(200).json({
        data: [
            { id: 1, name: 'Sample User 1', role: 'free' },
            { id: 2, name: 'Sample User 2', role: 'premium' },
        ],
        total: 2,
    });
});

/**
 * Catch-all for internal routes
 */
app.all('/internal/*', (req, res) => {
    res.status(200).json({
        message: `Backend received ${req.method} request`,
        path: req.path,
        body: req.body,
        timestamp: new Date().toISOString(),
    });
});

// ─────────────────────────────────────────
// 404 for non-internal routes
// ─────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'This endpoint is not exposed. Use the API Gateway.',
    });
});

// ─────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'═'.repeat(45)}`);
    console.log(`  🔧 Backend Service started`);
    console.log(`  🌐 Port: ${PORT}`);
    console.log(`  ⚠️  Internal only — use Gateway to access`);
    console.log(`${'═'.repeat(45)}\n`);
});

module.exports = app;
