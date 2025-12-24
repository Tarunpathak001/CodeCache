


const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const sanitize = require('sanitize-filename');
const config = require('../../config');
const db = require('../db/database');
const logger = require('../middleware/logger');
const { updateCacheStats, getPeakConcurrency, recordConcurrency } = require('../cache/cacheManager');
const EventEmitter = require('events');

const ongoingFetches = new Map();

async function handleNpmRequest(req, res, next) {
    // Sanitize to prevent path traversal
    const urlPath = req.params[0].split('/').map(segment => sanitize(segment)).join('/');
    
    // Reject auth tokens or credentials
    if (req.headers.authorization) {
        logger.warn(`Request with Authorization header blocked for ${urlPath}`);
        return res.status(401).send('Authorization headers are not proxied.');
    }

    const isTarball = urlPath.endsWith('.tgz');
    if (!isTarball) {
        return proxyMetadata(urlPath, res, next);
    }
    
    // e.g., /chalk/-/chalk-5.3.0.tgz -> { name: 'chalk', version: '5.3.0' }
    const match = urlPath.match(/(?:@.*\/)?(.*)\/-\/.*\-(.*)\.tgz$/);
    if (!match) {
        logger.warn(`Could not parse package name/version from URL: ${urlPath}`);
        return res.status(400).send('Invalid npm package URL format.');
    }
    const [, name, version] = match;
    const packageIdentifier = `${name}@${version}`;

    try {
        recordConcurrency(1); // Increment concurrency
        // Try with registry column first, fallback to without for backward compatibility
        let cacheEntry;
        try {
            cacheEntry = await db.get('SELECT * FROM packages WHERE name = ? AND version = ? AND (registry = ? OR registry IS NULL)', [name, version, 'npm']);
        } catch (error) {
            // Fallback for databases without registry column
            cacheEntry = await db.get('SELECT * FROM packages WHERE name = ? AND version = ?', [name, version]);
        }

        if (cacheEntry) { // Cache HIT
            logger.info(`[HIT] ${packageIdentifier} from ${cacheEntry.file_path}`);
            
            // Update stats in background, don't block the response
            Promise.all([
                db.serializedRun(
                    'UPDATE packages SET hits = hits + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
                    [cacheEntry.id]
                ).catch(err => logger.error('Error updating package hits:', err)),
                db.serializedRun(
                    'UPDATE stats SET value = value + 1 WHERE key = ?', ['hits']
                ).catch(err => logger.error('Error updating hit stats:', err)),
                db.serializedRun(
                    'UPDATE stats SET value = value + ? WHERE key = ?', [cacheEntry.size_bytes, 'bandwidthSaved']
                ).catch(err => logger.error('Error updating bandwidth stats:', err))
            ]).catch(err => logger.error('Error updating cache hit stats:', err));

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', cacheEntry.size_bytes);
            res.setHeader('X-Cache', 'HIT');
            const fileStream = fs.createReadStream(cacheEntry.file_path);
            fileStream.pipe(res);
            fileStream.on('error', (err) => next(err));
            fileStream.on('close', () => recordConcurrency(-1)); // Decrement on finish
        } else { // Cache MISS
            logger.info(`[MISS] ${packageIdentifier}. Fetching from upstream.`);
            
            // Update miss stats in background
            db.serializedRun('UPDATE stats SET value = value + 1 WHERE key = ?', ['misses'])
                .catch(err => logger.error('Error updating miss stats:', err));

            // Thundering herd protection
            if (ongoingFetches.has(packageIdentifier)) {
                logger.info(`[QUEUE] Request for ${packageIdentifier} is queued.`);
                ongoingFetches.get(packageIdentifier).once('done', (result) => {
                    recordConcurrency(-1); // Decrement on finish
                    if (result.success) {
                        res.redirect(req.originalUrl); // Simple redirect to retry and get a cache hit
                    } else {
                        res.status(500).json({ error: 'Upstream fetch failed', details: result.error });
                    }
                });
            } else {
                const emitter = new EventEmitter();
                ongoingFetches.set(packageIdentifier, emitter);
                
                try {
                    await fetchAndCachePackage(name, version, urlPath);
                    res.redirect(req.originalUrl); // Redirect to self to serve from cache
                    emitter.emit('done', { success: true });
                } catch (error) {
                    logger.error(`[FAIL] Failed to fetch and cache ${packageIdentifier}:`, error);
                    emitter.emit('done', { success: false, error: error.message });
                    next(error);
                } finally {
                    recordConcurrency(-1); // Decrement on finish
                    ongoingFetches.delete(packageIdentifier);
                }
            }
        }
    } catch (error) {
        recordConcurrency(-1);
        next(error);
    }
}

async function fetchAndCachePackage(name, version, urlPath) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const packageMetaUrl = `${config.npmRegistryUrl}/${name}`;
            const metaResponse = await axios.get(packageMetaUrl);
            const expectedChecksum = metaResponse.data.versions[version]?.dist.shasum;
            if (!expectedChecksum) {
                throw new Error(`Could not find shasum for ${name}@${version} in metadata.`);
            }

            const upstreamUrl = `${config.npmRegistryUrl}/${urlPath}`;
            const response = await axios({
                method: 'get',
                url: upstreamUrl,
                responseType: 'stream',
            });

            // Prepare cache paths
            const packageDir = path.join(config.cacheBasePath, name);
            await fsp.mkdir(packageDir, { recursive: true });
            const finalPath = path.join(packageDir, `${name}-${version}.tgz`);
            const tempPath = `${finalPath}.${Date.now()}.tmp`;
            
            const writer = fs.createWriteStream(tempPath);
            const hasher = crypto.createHash('sha1'); // npm uses sha1 for shasum

            response.data.pipe(writer);
            response.data.on('data', chunk => hasher.update(chunk));
            
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            const downloadedChecksum = hasher.digest('hex');
            if (downloadedChecksum !== expectedChecksum) {
                await fsp.unlink(tempPath);
                throw new Error(`Checksum mismatch for ${name}@${version}. Expected ${expectedChecksum}, got ${downloadedChecksum}.`);
            }

            // Atomic write
            await fsp.rename(tempPath, finalPath);

            const stats = await fsp.stat(finalPath);
            const sizeBytes = stats.size;

            // Try to insert with registry column, fallback without for backward compatibility
            try {
                await db.serializedRun(
                    'INSERT INTO packages (name, version, file_path, size_bytes, checksum, registry) VALUES (?, ?, ?, ?, ?, ?)',
                    [name, version, finalPath, sizeBytes, downloadedChecksum, 'npm']
                );
            } catch (err) {
                // Fallback for databases without registry column
                try {
                    await db.serializedRun(
                        'INSERT INTO packages (name, version, file_path, size_bytes, checksum) VALUES (?, ?, ?, ?, ?)',
                        [name, version, finalPath, sizeBytes, downloadedChecksum]
                    );
                } catch (fallbackErr) {
                    logger.error(`Error inserting package ${name}@${version} into database:`, fallbackErr);
                    // Don't throw here, the file is cached even if DB insert fails
                }
            }
            logger.info(`[CACHE] Successfully cached ${name}@${version} to ${finalPath}`);
            return; // Success, exit retry loop
        } catch (error) {
            logger.error(`Attempt ${attempt} failed for ${name}@${version}: ${error.message}`);
            if (attempt === maxRetries) {
                throw new Error(`Failed to fetch ${name}@${version} after ${maxRetries} attempts.`);
            }
        }
    }
}

async function proxyMetadata(urlPath, res, next) {
    try {
        const upstreamUrl = `${config.npmRegistryUrl}/${urlPath}`;
        const response = await axios({
            method: 'get',
            url: upstreamUrl,
            responseType: 'stream',
            headers: { 'Accept': 'application/json' }
        });
        res.status(response.status);
        for(const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
        }
        response.data.pipe(res);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).send(error.response.data);
        } else {
            next(error);
        }
    }
}

module.exports = { handleNpmRequest };