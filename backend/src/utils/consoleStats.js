


const { getCacheStats } = require('../cache/cacheManager');
const logger = require('../middleware/logger');

class ConsoleStatsDisplay {
    constructor() {
        this.lastStats = null;
        this.startTime = Date.now();
        this.sessionStats = {
            hits: 0,
            misses: 0,
            bandwidthSaved: 0,
            requests: 0,
            npm: { hits: 0, misses: 0, bandwidthSaved: 0 },
            pypi: { hits: 0, misses: 0, bandwidthSaved: 0 }
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    calculateTimeSaved(bandwidthSaved) {
        // Estimate time saved based on average download speed
        // Assuming average speed of 10 MB/s for direct registry downloads
        const avgSpeedBytesPerSecond = 10 * 1024 * 1024; // 10 MB/s
        const timeSavedSeconds = bandwidthSaved / avgSpeedBytesPerSecond;
        return timeSavedSeconds * 1000; // Convert to milliseconds
    }

    getRegistryFromPackageName(packageName) {
        if (packageName.includes('(PyPI)')) return 'pypi';
        return 'npm';
    }

    async displayHit(packageName, packageVersion, sizeBytes) {
        const registry = this.getRegistryFromPackageName(packageName);
        
        this.sessionStats.hits++;
        this.sessionStats.bandwidthSaved += sizeBytes;
        this.sessionStats.requests++;
        this.sessionStats[registry].hits++;
        this.sessionStats[registry].bandwidthSaved += sizeBytes;

        const timeSaved = this.calculateTimeSaved(sizeBytes);
        const timestamp = new Date().toLocaleTimeString();
        const registryIcon = registry === 'pypi' ? '🐍' : '📦';
        
        console.log('\n' + '='.repeat(80));
        console.log(`🎯 ${registryIcon} CACHE HIT [${timestamp}]: ${packageName}@${packageVersion}`);
        console.log(`📦 Package Size: ${this.formatBytes(sizeBytes)}`);
        console.log(`⚡ Time Saved: ~${this.formatTime(timeSaved)} (vs. registry download)`);
        console.log(`💾 Bandwidth Saved: ${this.formatBytes(sizeBytes)}`);
        console.log(`🚀 Instant delivery from local cache!`);
        
        await this.displayCurrentStats();
        console.log('='.repeat(80));
    }

    async displayMiss(packageName, packageVersion) {
        const registry = this.getRegistryFromPackageName(packageName);
        
        this.sessionStats.misses++;
        this.sessionStats.requests++;
        this.sessionStats[registry].misses++;

        const timestamp = new Date().toLocaleTimeString();
        const registryIcon = registry === 'pypi' ? '🐍' : '📦';
        const registryName = registry === 'pypi' ? 'PyPI' : 'npm';

        console.log('\n' + '='.repeat(80));
        console.log(`❌ ${registryIcon} CACHE MISS [${timestamp}]: ${packageName}@${packageVersion}`);
        console.log(`🔄 Downloading from ${registryName} registry...`);
        console.log(`💾 Will be cached for future requests`);
        
        await this.displayCurrentStats();
        console.log('='.repeat(80));
    }

    async displayCurrentStats() {
        try {
            const stats = await getCacheStats();
            const uptime = Date.now() - this.startTime;
            const totalTimeSaved = this.calculateTimeSaved(stats.bandwidthSaved);
            const hitRate = (stats.hits + stats.misses) > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0;

            console.log(`\n📊 CURRENT STATISTICS:`);
            console.log(`   Uptime: ${this.formatTime(uptime)}`);
            console.log(`   Total Requests: ${(stats.hits + stats.misses).toLocaleString()}`);
            console.log(`   Cache Hits: ${stats.hits.toLocaleString()} | Misses: ${stats.misses.toLocaleString()}`);
            console.log(`   Hit Rate: ${hitRate.toFixed(1)}%`);
            console.log(`   Total Bandwidth Saved: ${this.formatBytes(stats.bandwidthSaved)}`);
            console.log(`   Estimated Time Saved: ${this.formatTime(totalTimeSaved)}`);
            console.log(`   Cached Packages: ${stats.numPackages.toLocaleString()}`);
            console.log(`   Cache Size: ${this.formatBytes(stats.cacheSizeBytes)} / ${this.formatBytes(stats.cacheSizeLimitBytes)}`);
            
            console.log(`\n🔄 SESSION STATISTICS (since server start):`);
            console.log(`   Session Requests: ${this.sessionStats.requests}`);
            console.log(`   Session Hits: ${this.sessionStats.hits} | Misses: ${this.sessionStats.misses}`);
            console.log(`   📦 npm: ${this.sessionStats.npm.hits} hits, ${this.sessionStats.npm.misses} misses, ${this.formatBytes(this.sessionStats.npm.bandwidthSaved)} saved`);
            console.log(`   🐍 PyPI: ${this.sessionStats.pypi.hits} hits, ${this.sessionStats.pypi.misses} misses, ${this.formatBytes(this.sessionStats.pypi.bandwidthSaved)} saved`);
            console.log(`   Session Bandwidth Saved: ${this.formatBytes(this.sessionStats.bandwidthSaved)}`);
            console.log(`   Session Time Saved: ${this.formatTime(this.calculateTimeSaved(this.sessionStats.bandwidthSaved))}`);
        } catch (error) {
            logger.error('Error displaying stats:', error);
        }
    }

    async displayStartupBanner() {
        console.log('\n' + '█'.repeat(80));
        console.log('█' + ' '.repeat(78) + '█');
        console.log('█' + '  📦🐍 CodeCache Pro - Multi-Registry Cache Server'.padEnd(78) + '█');
        console.log('█' + '  Supports: npm (Node.js) + PyPI (Python)'.padEnd(78) + '█');
        console.log('█' + ' '.repeat(78) + '█');
        console.log('█'.repeat(80));
        
        await this.displayCurrentStats();
        
        console.log('\n🚀 Server is ready! Monitoring npm and PyPI requests...');
        console.log('📦 npm packages: /npm/<package>');
        console.log('🐍 PyPI packages: /pypi/<package>');
        console.log('💡 Stats will be displayed in real-time as clients make requests.\n');
    }

    displayPeriodicStats() {
        // Display stats every 5 minutes
        setInterval(async () => {
            console.log('\n' + '⏰ PERIODIC STATS UPDATE '.padEnd(80, '─'));
            await this.displayCurrentStats();
            console.log('─'.repeat(80));
        }, 5 * 60 * 1000); 
    }
}


const consoleStats = new ConsoleStatsDisplay();

module.exports = consoleStats;