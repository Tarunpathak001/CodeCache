// Simple script to display current cache statistics
const axios = require('axios');

async function showStats() {
    try {
        console.log('📊 CodeCache Pro Statistics\n');
        
        // Get detailed stats
        const response = await axios.get('http://localhost:5050/packet-stats');
        const stats = response.data;
        
        console.log('🎯 CACHE PERFORMANCE:');
        console.log(`   Total Requests: ${(stats.hits + stats.misses).toLocaleString()}`);
        console.log(`   Cache Hits: ${stats.hits.toLocaleString()}`);
        console.log(`   Cache Misses: ${stats.misses.toLocaleString()}`);
        console.log(`   Hit Rate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}%`);
        
        console.log('\n💾 STORAGE:');
        console.log(`   Cached Packages: ${stats.numPackages.toLocaleString()}`);
        console.log(`   Cache Size: ${formatBytes(stats.cacheSizeBytes)}`);
        console.log(`   Cache Limit: ${formatBytes(stats.cacheSizeLimitBytes)}`);
        console.log(`   Usage: ${((stats.cacheSizeBytes / stats.cacheSizeLimitBytes) * 100).toFixed(1)}%`);
        
        console.log('\n⚡ SAVINGS:');
        console.log(`   Bandwidth Saved: ${formatBytes(stats.bandwidthSaved)}`);
        console.log(`   Time Saved: ~${formatTime(calculateTimeSaved(stats.bandwidthSaved))}`);
        
        if (stats.registryStats && stats.registryStats.length > 0) {
            console.log('\n📦 BY REGISTRY:');
            stats.registryStats.forEach(registry => {
                console.log(`   ${registry.registry.toUpperCase()}: ${registry.package_count} packages, ${registry.total_hits} hits, ${formatBytes(registry.total_size || 0)}`);
            });
        }
        
        console.log(`\n🕒 Last Updated: ${new Date(stats.timestamp).toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
        console.log('Make sure the server is running on http://localhost:5050');
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(ms) {
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

function calculateTimeSaved(bandwidthSaved) {
    const avgSpeedBytesPerSecond = 10 * 1024 * 1024; // 10 MB/s
    const timeSavedSeconds = bandwidthSaved / avgSpeedBytesPerSecond;
    return timeSavedSeconds * 1000;
}

// Run the stats display
showStats();