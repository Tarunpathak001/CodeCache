


const express = require('express');
const db = require('../db/database');
const { handleNpmRequest } = require('../fetchers/npmFetcher');
const { handlePypiRequest } = require('../fetchers/pypiFetcher');
const { getCacheStats, clearCache } = require('../cache/cacheManager');
const logger = require('../middleware/logger');

const router = express.Router();

// Root endpoint - Dashboard info
router.get('/', (req, res) => {
    res.status(200).json({
        message: 'CodeCache Pro - Multi-Registry Package Cache Server',
        version: '1.0.0',
        status: 'ok',
        timestamp: new Date().toISOString(),
        registries: {
            npm: 'http://192.168.137.47:5050/npm',
            pypi: 'http://192.168.137.47:5050/pypi'
        },
        endpoints: {
            health: '/health',
            stats: '/stats',
            'packet-stats': '/packet-stats',
            packages: '/packages',
            'clear-cache': '/clear-cache (POST)'
        },
        configuration: {
            npm: 'npm config set registry http://192.168.137.47:5050/npm',
            pip: 'pip config set global.index-url http://192.168.137.47:5050/pypi && pip config set global.trusted-host 192.168.137.47'
        }
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// PyPI proxy endpoint (must come before npm to avoid conflicts)
router.get('/pypi/*', handlePypiRequest);
router.get('/pypi', handlePypiRequest);
// Block other PyPI-related methods to prevent publish attempts
router.all('/pypi/*', (req, res) => {
    logger.warn(`Blocked unsupported method ${req.method} for ${req.originalUrl}`);
    res.status(405).json({ error: 'Method Not Allowed. Only GET requests are proxied.' });
});

// NPM registry root endpoint
router.get('/npm', (req, res) => {
    res.status(200).json({
        message: 'CodeCache Pro NPM Registry Proxy',
        status: 'ok',
        timestamp: new Date().toISOString(),
        usage: 'Use /npm/<package-name> for package metadata or /npm/<package>/-/<tarball>.tgz for downloads'
    });
});

// NPM proxy endpoint
router.get('/npm/*', handleNpmRequest);
// Block other NPM-related methods to prevent publish attempts
router.all('/npm/*', (req, res) => {
    logger.warn(`Blocked unsupported method ${req.method} for ${req.originalUrl}`);
    res.status(405).json({ error: 'Method Not Allowed. Only GET requests are proxied.' });
});

// Statistics endpoint
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await getCacheStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// List all cached packages
router.get('/packages', async (req, res, next) => {
    try {
        const packages = await db.all('SELECT * FROM packages ORDER BY name, created_at DESC');
        res.json(packages);
    } catch (error) {
        next(error);
    }
});

// Clear cache endpoint
router.post('/clear-cache', async (req, res, next) => {
    try {
        await clearCache();
        res.status(200).json({ message: 'Cache cleared successfully.' });
    } catch (error) {
        next(error);
    }
});

// Detailed packet statistics endpoint
router.get('/packet-stats', async (req, res, next) => {
    try {
        const stats = await getCacheStats();

        // Get recent activity (last 24 hours)
        const recentActivity = await db.all(`
            SELECT 
                DATE(last_accessed) as date,
                COUNT(*) as requests,
                SUM(hits) as hits,
                registry
            FROM packages 
            WHERE last_accessed >= datetime('now', '-24 hours')
            GROUP BY DATE(last_accessed), registry
            ORDER BY date DESC
        `);

        // Get top requested packages by registry
        const topPackages = await db.all(`
            SELECT name, version, hits, size_bytes, last_accessed, registry
            FROM packages 
            ORDER BY hits DESC 
            LIMIT 20
        `);

        // Get registry breakdown
        const registryStats = await db.all(`
            SELECT 
                COALESCE(registry, 'npm') as registry,
                COUNT(*) as package_count,
                SUM(size_bytes) as total_size,
                SUM(hits) as total_hits
            FROM packages 
            GROUP BY COALESCE(registry, 'npm')
        `);

        res.json({
            ...stats,
            timestamp: new Date().toISOString(),
            recentActivity,
            topPackages,
            registryStats,
            efficiency: {
                hitRate: stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0,
                totalRequests: stats.hits + stats.misses,
                cacheEfficiency: stats.cacheSizeBytes > 0 ? (stats.bandwidthSaved / stats.cacheSizeBytes) : 0
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;