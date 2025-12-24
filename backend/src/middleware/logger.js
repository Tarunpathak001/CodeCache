


const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('../../config');
const path = require('path');

const transport = new winston.transports.DailyRotateFile({
    filename: path.join(config.logsPath, 'codecache-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
});

const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
        transport,
    ],
});

const httpLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.get('User-Agent')}`);
    });
    next();
};

module.exports = logger;
module.exports.httpLogger = httpLogger;