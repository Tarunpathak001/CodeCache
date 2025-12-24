// /backend/config.js
// Purpose: Loads and centralizes all configuration for the backend server.
// It uses dotenv to load environment variables from a .env file.

require('dotenv').config();
const path = require('path');

const config = {
    port: process.env.PORT || 5050,
    cacheSizeLimitBytes: parseInt(process.env.CACHE_SIZE_LIMIT_BYTES, 10) || 5 * 1024 * 1024 * 1024,
    npmRegistryUrl: process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org',
    pypiRegistryUrl: process.env.PYPI_REGISTRY_URL || 'https://pypi.org/simple',
    logLevel: process.env.LOG_LEVEL || 'info',
    databasePath: path.join(__dirname, '..', 'codecache.db'),
    cacheBasePath: path.join(__dirname, '..', 'cache'),
    logsPath: path.join(__dirname, '..', 'logs'),
};

module.exports = config;