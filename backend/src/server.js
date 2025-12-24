



const app = require('./app');
const config = require('../config');
const logger = require('./middleware/logger');
const db = require('./db/database');
const { startPruningInterval } = require('./cache/pruning');
const consoleStats = require('./utils/consoleStats');

const startServer = async () => {
    try {
        await db.initDb();
        logger.info('Database initialized successfully.');

        startPruningInterval();
        logger.info('Cache pruning service started.');

        const server = app.listen(config.port, '0.0.0.0', () => {
            // Get the actual network IP address
            const os = require('os');
            const networkInterfaces = os.networkInterfaces();
            let localIP = 'localhost';
            
            // Find the first non-internal IPv4 address
            for (const interfaceName in networkInterfaces) {
                const addresses = networkInterfaces[interfaceName];
                for (const address of addresses) {
                    if (address.family === 'IPv4' && !address.internal) {
                        localIP = address.address;
                        break;
                    }
                }
                if (localIP !== 'localhost') break;
            }
            
            logger.info(`🚀 CodeCache Pro server running on http://0.0.0.0:${config.port}`);
            logger.info(`🌐 Access from other devices: http://${localIP}:${config.port}`);
            logger.info(`📋 Configure npm clients with: npm config set registry http://${localIP}:${config.port}/npm`);
            logger.info(`🐍 Configure pip clients with: pip config set global.index-url http://${localIP}:${config.port}/pypi`);
            
            // Display startup banner and stats
            consoleStats.displayStartupBanner();
            
            // Start periodic stats display
            consoleStats.displayPeriodicStats();
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${config.port} is already in use. Please stop other services or change the port in .env file.`);
                process.exit(1);
            } else {
                logger.error('Server error:', error);
                process.exit(1);
            }
        });

        const gracefullyShutdown = (signal) => {
            logger.info(`${signal} received. Shutting down gracefully...`);
            server.close(() => {
                logger.info('HTTP server closed.');
                db.closeDb();
                logger.info('Database connection closed.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefullyShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefullyShutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();