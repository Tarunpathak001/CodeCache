


const logger = require('./logger');

function errorHandler(err, req, res, next) {
    logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    logger.error(err.stack);

    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
        },
    });
}

module.exports = errorHandler;