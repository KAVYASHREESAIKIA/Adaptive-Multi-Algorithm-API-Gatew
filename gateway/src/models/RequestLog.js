const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RequestLog = sequelize.define('RequestLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    method: {
        type: DataTypes.STRING(10),
        allowNull: false,
    },
    status: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    response_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    algorithm_used: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    gateway_instance: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    tableName: 'request_logs',
    timestamps: true,
});

RequestLog.associate = (models) => {
    RequestLog.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
    });
};

module.exports = RequestLog;
