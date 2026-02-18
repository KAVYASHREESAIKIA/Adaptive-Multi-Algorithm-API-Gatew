const http = require('http');
const config = require('../config');
const circuitBreaker = require('../services/circuitBreaker');
const RequestLog = require('../models/RequestLog');
const logger = require('../utils/logger');

/**
 * Proxy Controller
 * 
 * Forwards authenticated and rate-limited requests to the backend service.
 * Handles circuit breaker state transitions based on backend responses.
 */

/**
 * Forward request to backend service
 */
const forwardToBackend = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user ? req.user.id : null;
    const instanceId = process.env.INSTANCE_ID || 'default';

    try {
        const backendUrl = new URL(config.backend.url);

        // Map public endpoint to internal backend endpoint
        let backendPath = req.originalUrl;
        if (backendPath.startsWith('/api/')) {
            backendPath = '/internal/' + backendPath.substring(5);
        }

        const options = {
            hostname: backendUrl.hostname,
            port: backendUrl.port,
            path: backendPath,
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': req.ip,
                'X-Gateway-Instance': instanceId,
                'X-User-Id': userId || 'anonymous',
                'X-User-Role': req.user ? req.user.role : 'none',
            },
            timeout: 10000, // 10 second timeout
        };

        const proxyReq = http.request(options, (proxyRes) => {
            let body = '';

            proxyRes.on('data', (chunk) => {
                body += chunk;
            });

            proxyRes.on('end', async () => {
                const responseTime = Date.now() - startTime;

                // Circuit breaker: record success
                circuitBreaker.onSuccess();

                // Set response headers
                res.set({
                    'X-Gateway-Instance': instanceId,
                    'X-Response-Time': `${responseTime}ms`,
                    'X-Proxied-By': 'adaptive-api-gateway',
                });

                // Log the request
                try {
                    await RequestLog.create({
                        user_id: userId,
                        endpoint: req.originalUrl,
                        method: req.method,
                        status: proxyRes.statusCode,
                        ip_address: req.ip,
                        response_time_ms: responseTime,
                        algorithm_used: req.algorithmUsed || 'none',
                        gateway_instance: instanceId,
                    });
                } catch (logError) {
                    logger.error('Request logging failed:', logError.message);
                }

                // Forward response
                try {
                    const jsonBody = JSON.parse(body);
                    res.status(proxyRes.statusCode).json(jsonBody);
                } catch (e) {
                    res.status(proxyRes.statusCode).send(body);
                }
            });
        });

        proxyReq.on('error', async (error) => {
            const responseTime = Date.now() - startTime;

            // Circuit breaker: record failure
            circuitBreaker.onFailure();

            logger.error(`Backend request failed: ${error.message}`);

            // Log failed request
            try {
                await RequestLog.create({
                    user_id: userId,
                    endpoint: req.originalUrl,
                    method: req.method,
                    status: 502,
                    ip_address: req.ip,
                    response_time_ms: responseTime,
                    algorithm_used: req.algorithmUsed || 'none',
                    gateway_instance: instanceId,
                });
            } catch (logError) {
                logger.error('Request logging failed:', logError.message);
            }

            res.status(502).json({
                error: 'Bad Gateway',
                message: 'Backend service is unavailable',
                instance: instanceId,
            });
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            circuitBreaker.onFailure();

            res.status(504).json({
                error: 'Gateway Timeout',
                message: 'Backend service did not respond in time',
                instance: instanceId,
            });
        });

        // Forward request body if present
        if (req.body && Object.keys(req.body).length > 0) {
            proxyReq.write(JSON.stringify(req.body));
        }

        proxyReq.end();
    } catch (error) {
        logger.error('Proxy error:', error.message);
        circuitBreaker.onFailure();

        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Gateway proxy error',
        });
    }
};

module.exports = { forwardToBackend };
