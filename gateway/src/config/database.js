const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    define: {
        timestamps: true,
        underscored: true,
    },
});

const connectDatabase = async () => {
    let retries = 10;
    while (retries > 0) {
        try {
            await sequelize.authenticate();
            logger.info('✅ PostgreSQL connected successfully');
            await sequelize.sync({ alter: true });
            logger.info('✅ Database models synchronized');
            return;
        } catch (error) {
            retries--;
            logger.warn(`⏳ Database connection failed. Retries left: ${retries}`);
            if (retries === 0) {
                logger.error('❌ Failed to connect to PostgreSQL:', error.message);
                throw error;
            }
            await new Promise((res) => setTimeout(res, 5000));
        }
    }
};

module.exports = { sequelize, connectDatabase };
