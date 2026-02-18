const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const {
    changeAlgorithm,
    getStats,
    unblockUser,
    getUserBehavior,
    resetCircuitBreaker,
    getCircuitBreakerStatus,
    getLogs,
} = require('../controllers/adminController');

/**
 * Admin Routes (require admin role)
 * 
 * POST   /admin/algorithm                - Change active rate limiting algorithm
 * GET    /admin/stats                    - Get system statistics
 * POST   /admin/unblock/:userId          - Unblock a user
 * GET    /admin/behavior/:userId         - Get user behavior metrics
 * POST   /admin/circuit-breaker/reset    - Reset circuit breaker
 * GET    /admin/circuit-breaker/status   - Get circuit breaker status
 * GET    /admin/logs                      - Get recent request logs
 */

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.post('/algorithm', changeAlgorithm);
router.get('/stats', getStats);
router.post('/unblock/:userId', unblockUser);
router.get('/behavior/:userId', getUserBehavior);
router.post('/circuit-breaker/reset', resetCircuitBreaker);
router.get('/circuit-breaker/status', getCircuitBreakerStatus);
router.get('/logs', getLogs);

module.exports = router;
