const User = require('./User');
const RequestLog = require('./RequestLog');
const RefreshToken = require('./RefreshToken');

const models = {
    User,
    RequestLog,
    RefreshToken
};

// Call associate for each model
Object.values(models).forEach(model => {
    if (model.associate) {
        model.associate(models);
    }
});

module.exports = models;
