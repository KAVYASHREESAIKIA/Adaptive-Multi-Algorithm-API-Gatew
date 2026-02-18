const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { behaviorAnalyzer } = require('../middleware/behavior.middleware');
const { rateLimitMiddleware } = require('../middleware/rateLimit.middleware');
const { circuitBreakerMiddleware } = require('../middleware/circuitBreaker.middleware');
const { forwardToBackend } = require('../controllers/proxyController');

/**
 * Protected API Routes
 * 
 * Full middleware chain:
 * 1. authenticate       - JWT + API key verification
 * 2. behaviorAnalyzer   - Calculate behavior score & effective limit
 * 3. rateLimitMiddleware - Apply active rate limit algorithm
 * 4. circuitBreaker     - Check backend availability
 * 5. forwardToBackend   - Proxy to backend service
 * 
 * GET  /api/data       - Get protected data
 * POST /api/resource   - Create a resource
 * GET  /api/*          - Catch-all forward
 */

// Apply the full middleware chain
const middlewareChain = [
    authenticate,
    behaviorAnalyzer,
    rateLimitMiddleware,
    circuitBreakerMiddleware,
];

router.get('/data', ...middlewareChain, forwardToBackend);
router.post('/resource', ...middlewareChain, forwardToBackend);
router.all('/*', ...middlewareChain, forwardToBackend);

module.exports = router;
