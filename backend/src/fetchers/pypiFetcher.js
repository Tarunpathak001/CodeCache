


const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const sanitize = require('sanitize-filename');
const config = require('../../config');
const db = require('../db/database');
const logger = require('../middleware/logger');
const { recordConcurrency } = require('../cache/cacheManager');
const consoleStats = require('../utils/consoleStats');
const EventEmitter = require('events');

const ongoingFetches = new Map();

async function handlePypiRequest(req, res, next) {
    try {
        // Handle the case where req.params[0] might be undefined (for /pypi root requests)
        const rawPath = req.params[0] || '';
        const urlPath = rawPath.split('/').map(segment => sanitize(segment)).join('/');
        
        // Reject auth tokens or credentials
        if (req.headers.authorization) {
            logger.warn(`Request with Authorization header blocked for ${urlPath}`);
            return res.status(401).send('Authorization headers are not proxied.');
        }

        logger.info(`[PYPI REQUEST] ${req.method} ${req.originalUrl} -> "${urlPath}"`);

        
        const isPackageFile = urlPath.match(/\.(whl|tar\.gz)$/);
        logger.info(`[PYPI DEBUG] Is package file: ${!!isPackageFile}, URL: "${urlPath}"`);
        
        if (!isPackageFile) {
            logger.info(`[PYPI METADATA] Proxying metadata request for: "${urlPath}"`);
            return proxyPypiMetadata(urlPath, res, next);
        }
        
        logger.info(`[PYPI PACKAGE] Detected package file download: "${urlPath}"`);
    
        
        const pathParts = urlPath.split('/').filter(part => part.length > 0);
        logger.info(`[PYPI DEBUG] Path parts: ${JSON.stringify(pathParts)}`);
        
        if (pathParts.length < 2) {
            logger.warn(`Invalid PyPI package URL format: ${urlPath}, parts: ${JSON.stringify(pathParts)}`);
            return res.status(400).send('Invalid PyPI package URL format.');
        }

        const packageName = pathParts[0];
        const filename = pathParts[pathParts.length - 1];
        
        logger.info(`[PYPI DEBUG] Package: "${packageName}", Filename: "${filename}"`);
        
        
        const version = extractVersionFromFilename(packageName, filename);
        logger.info(`[PYPI DEBUG] Extracted version: "${version}"`);
        
        if (!version) {
            logger.warn(`Could not parse version from filename: ${filename} for package: ${packageName}`);
            return res.status(400).send('Could not parse package version from filename.');
        }

        const packageIdentifier = `${packageName}@${version}`;

        recordConcurrency(1); // Increment concurrency
        
        // Try with registry column first, fallback to without for backward compatibility
        let cacheEntry;
        try {
            cacheEntry = await db.get('SELECT * FROM packages WHERE name = ? AND version = ? AND registry = ?', [packageName, version, 'pypi']);
        } catch (error) {
            // If registry column doesn't exist, PyPI packages won't be found (which is correct)
            cacheEntry = null;
        }

        if (cacheEntry) { // Cache HIT
            logger.info(`[PYPI HIT] ${packageIdentifier} from ${cacheEntry.file_path}`);
            
            // Display real-time stats in console
            consoleStats.displayHit(`${packageName} (PyPI)`, version, cacheEntry.size_bytes);
            
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
            res.setHeader('X-Registry', 'PyPI');
            const fileStream = fs.createReadStream(cacheEntry.file_path);
            fileStream.pipe(res);
            fileStream.on('error', (err) => next(err));
            fileStream.on('close', () => recordConcurrency(-1)); // Decrement on finish
        } else { // Cache MISS
            logger.info(`[PYPI MISS] ${packageIdentifier}. Fetching from upstream.`);
            
            // Display real-time stats in console
            consoleStats.displayMiss(`${packageName} (PyPI)`, version);
            
            // Update miss stats in background
            db.serializedRun('UPDATE stats SET value = value + 1 WHERE key = ?', ['misses'])
                .catch(err => logger.error('Error updating miss stats:', err));

            // Thundering herd protection
            if (ongoingFetches.has(packageIdentifier)) {
                logger.info(`[PYPI QUEUE] Request for ${packageIdentifier} is queued.`);
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
                    await fetchAndCachePypiPackage(packageName, version, filename, urlPath);
                    res.redirect(req.originalUrl); // Redirect to self to serve from cache
                    emitter.emit('done', { success: true });
                } catch (error) {
                    logger.error(`[PYPI FAIL] Failed to fetch and cache ${packageIdentifier}:`, error);
                    emitter.emit('done', { success: false, error: error.message });
                    next(error);
                } finally {
                    recordConcurrency(-1); // Decrement on finish
                    ongoingFetches.delete(packageIdentifier);
                }
            }
        }
    } catch (error) {
        logger.error(`[PYPI ERROR] ${error.message}`);
        recordConcurrency(-1);
        next(error);
    }
}

function extractVersionFromFilename(packageName, filename) {
    // Handle wheel files: package-name-version-py3-none-any.whl
    const wheelMatch = filename.match(new RegExp(`^${escapeRegex(packageName.replace(/-/g, '_'))}-(.+?)-(py\\d+|cp\\d+|pp\\d+)`));
    if (wheelMatch) {
        return wheelMatch[1];
    }
    
    // Handle tar.gz files: package-name-version.tar.gz
    const tarMatch = filename.match(new RegExp(`^${escapeRegex(packageName)}-(.+?)\\.tar\\.gz$`));
    if (tarMatch) {
        return tarMatch[1];
    }
    
    return null;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchAndCachePypiPackage(packageName, version, filename, urlPath) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // First, get the package's simple index page to find the download URL and hash
            const indexUrl = `${config.pypiRegistryUrl}/${packageName}/`;
            logger.info(`[PYPI] Fetching index from ${indexUrl} to find download URL for ${filename}`);
            
            const indexResponse = await axios.get(indexUrl, {
                timeout: 15000,
                headers: { 'Accept': 'text/html' }
            });
            
            
            const linkRegex = new RegExp(`<a[^>]+href="([^"]*${escapeRegex(filename)}[^"]*)"[^>]*>`, 'i');
            const linkMatch = indexResponse.data.match(linkRegex);
            
            if (!linkMatch) {
                logger.error(`[PYPI] Could not find download link for ${filename} in PyPI index`);
                logger.error(`[PYPI] Index content preview: ${indexResponse.data.substring(0, 500)}`);
                throw new Error(`Could not find download link for ${filename} in PyPI index`);
            }
            
            const downloadUrl = linkMatch[1];
            logger.info(`[PYPI] Found download URL: ${downloadUrl}`);
            
            // Extract sha256 hash from URL fragment
            const hashMatch = downloadUrl.match(/#sha256=([a-f0-9]{64})/i);
            if (!hashMatch) {
                logger.warn(`[PYPI] No SHA256 hash found for ${filename}, proceeding without verification`);
            }
            
            const expectedChecksum = hashMatch ? hashMatch[1] : null;
            if (expectedChecksum) {
                logger.info(`[PYPI] Expected SHA256: ${expectedChecksum}`);
            }

            // Download the package
            logger.info(`[PYPI] Downloading package from: ${downloadUrl}`);
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'User-Agent': 'pip/23.0 CodeCache-Pro/1.0.0'
                }
            });

            // Prepare cache paths
            const packageDir = path.join(config.cacheBasePath, 'pypi', packageName);
            await fsp.mkdir(packageDir, { recursive: true });
            const finalPath = path.join(packageDir, filename);
            const tempPath = `${finalPath}.${Date.now()}.tmp`;
            
            logger.info(`[PYPI] Caching to: ${finalPath}`);
            
            const writer = fs.createWriteStream(tempPath);
            const hasher = crypto.createHash('sha256');

            response.data.pipe(writer);
            response.data.on('data', chunk => hasher.update(chunk));
            
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            const downloadedChecksum = hasher.digest('hex');
            
            // Verify checksum if we have one
            if (expectedChecksum && downloadedChecksum !== expectedChecksum) {
                await fsp.unlink(tempPath);
                throw new Error(`Checksum mismatch for ${filename}. Expected ${expectedChecksum}, got ${downloadedChecksum}.`);
            }

            // Atomic write
            await fsp.rename(tempPath, finalPath);

            const stats = await fsp.stat(finalPath);
            const sizeBytes = stats.size;

            // Try to insert with registry column, fallback without for backward compatibility
            try {
                await db.serializedRun(
                    'INSERT INTO packages (name, version, file_path, size_bytes, checksum, registry) VALUES (?, ?, ?, ?, ?, ?)',
                    [packageName, version, finalPath, sizeBytes, downloadedChecksum, 'pypi']
                );
                logger.info(`[PYPI] Added to database: ${packageName}@${version}`);
            } catch (err) {
                logger.error(`Error inserting PyPI package ${packageName}@${version} into database:`, err);
                // Don't throw here, the file is cached even if DB insert fails
            }
            
            logger.info(`[PYPI CACHE] Successfully cached ${packageName}@${version} (${sizeBytes} bytes) to ${finalPath}`);
            return; // Success, exit retry loop
        } catch (error) {
            logger.error(`PyPI attempt ${attempt} failed for ${packageName}@${version}: ${error.message}`);
            if (attempt === maxRetries) {
                throw new Error(`Failed to fetch PyPI package ${packageName}@${version} after ${maxRetries} attempts.`);
            }
        }
    }
}

async function proxyPypiMetadata(urlPath, res, next) {
    try {
        // Handle root pypi request
        if (!urlPath || urlPath === '') {
            return res.status(200).json({ 
                message: 'CodeCache Pro PyPI Registry Proxy',
                status: 'ok',
                timestamp: new Date().toISOString(),
                usage: 'Use /pypi/<package-name>/ for package metadata'
            });
        }

        // Clean the path and ensure it ends with / for package index requests
        let cleanPath = urlPath.replace(/^\/+|\/+$/g, '');
        if (!cleanPath.includes('.') && !cleanPath.endsWith('/')) {
            cleanPath += '/';
        }

        const upstreamUrl = `${config.pypiRegistryUrl}/${cleanPath}`;
        logger.info(`[PYPI PROXY] Fetching metadata from: ${upstreamUrl}`);
        
        const response = await axios({
            method: 'get',
            url: upstreamUrl,
            timeout: 15000,
            responseType: 'text',
            headers: { 
                'Accept': 'text/html',
                'User-Agent': 'pip/23.0 CodeCache-Pro/1.0.0'
            }
        });
        
        logger.info(`[PYPI PROXY] Successfully fetched metadata for ${cleanPath}, size: ${response.data.length} chars`);
        
        // Set the correct headers for PyPI simple API
        res.status(response.status);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        
        // Send the raw HTML response from PyPI
        res.send(response.data);
        
    } catch (error) {
        logger.error(`[PYPI PROXY ERROR] Failed to fetch ${urlPath}: ${error.message}`);
        
        if (error.response) {
            logger.error(`[PYPI PROXY ERROR] Response status: ${error.response.status}, data: ${error.response.data?.substring(0, 200)}`);
            res.status(error.response.status);
            res.setHeader('Content-Type', 'text/html');
            res.send(error.response.data || `Error ${error.response.status}: ${error.response.statusText}`);
        } else if (error.code === 'ENOTFOUND') {
            res.status(502).send('Bad Gateway: Cannot reach PyPI registry - DNS resolution failed');
        } else if (error.code === 'ECONNREFUSED') {
            res.status(502).send('Bad Gateway: Cannot reach PyPI registry - Connection refused');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
            res.status(504).send('Gateway Timeout: PyPI registry took too long to respond');
        } else {
            res.status(500).send(`Internal Server Error: ${error.message}`);
        }
    }
}

module.exports = { handlePypiRequest };