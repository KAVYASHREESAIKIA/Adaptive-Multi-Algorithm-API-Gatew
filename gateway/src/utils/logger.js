const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            const instanceId = process.env.INSTANCE_ID || 'gateway';
            const logMsg = `[${timestamp}] [${instanceId}] ${level.toUpperCase()}: ${message}`;
            return stack ? `${logMsg}\n${stack}` : logMsg;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, stack }) => {
                    const instanceId = process.env.INSTANCE_ID || 'gateway';
                    const logMsg = `[${timestamp}] [${instanceId}] ${level}: ${message}`;
                    return stack ? `${logMsg}\n${stack}` : logMsg;
                })
            ),
        }),
    ],
});

module.exports = logger;
