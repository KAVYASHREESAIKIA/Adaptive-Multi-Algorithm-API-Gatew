const logger = require('../utils/logger');
const config = require('../config');

/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures when the backend service is down.
 * 
 * States:
 * - CLOSED:    Normal operation, requests pass through
 * - OPEN:      Backend is down, all requests are rejected immediately
 * - HALF_OPEN: Testing if backend has recovered
 * 
 * Transition rules:
 * CLOSED → OPEN:      When failure count exceeds threshold within window
 * OPEN → HALF_OPEN:   After reset timeout expires
 * HALF_OPEN → CLOSED: When a test request succeeds
 * HALF_OPEN → OPEN:   When a test request fails
 */
class CircuitBreaker {
    constructor() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        this.failureThreshold = config.circuitBreaker.failureThreshold;
        this.resetTimeout = config.circuitBreaker.resetTimeout;
        this.halfOpenRequests = config.circuitBreaker.halfOpenRequests;
        this.halfOpenSuccessCount = 0;

        logger.info(`⚡ Circuit Breaker initialized: threshold=${this.failureThreshold}, timeout=${this.resetTimeout}ms`);
    }

    /**
     * Check if the circuit allows a request to pass through
     */
    canRequest() {
        const now = Date.now();

        switch (this.state) {
            case 'CLOSED':
                return true;

            case 'OPEN':
                // Check if reset timeout has elapsed
                if (now >= this.nextAttemptTime) {
                    this.state = 'HALF_OPEN';
                    this.halfOpenSuccessCount = 0;
                    logger.info('⚡ Circuit Breaker → HALF_OPEN (testing backend recovery)');
                    return true;
                }
                return false;

            case 'HALF_OPEN':
                // Allow limited requests to test
                return this.halfOpenSuccessCount < this.halfOpenRequests;

            default:
                return true;
        }
    }

    /**
     * Record a successful request
     */
    onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.halfOpenSuccessCount++;
            if (this.halfOpenSuccessCount >= this.halfOpenRequests) {
                this.state = 'CLOSED';
                this.failureCount = 0;
                this.successCount = 0;
                logger.info('✅ Circuit Breaker → CLOSED (backend recovered)');
            }
        }
        this.failureCount = Math.max(0, this.failureCount - 1);
        this.successCount++;
    }

    /**
     * Record a failed request
     */
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.resetTimeout;
            logger.warn('🔴 Circuit Breaker → OPEN (backend still failing in half-open)');
            return;
        }

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.resetTimeout;
            logger.warn(`🔴 Circuit Breaker → OPEN (${this.failureCount} failures exceeded threshold)`);
        }
    }

    /**
     * Get current circuit breaker status
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            failureThreshold: this.failureThreshold,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
            resetTimeoutMs: this.resetTimeout,
        };
    }

    /**
     * Force reset the circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        this.halfOpenSuccessCount = 0;
        logger.info('🔄 Circuit Breaker manually reset → CLOSED');
    }
}

// Singleton instance
const circuitBreaker = new CircuitBreaker();

module.exports = circuitBreaker;
