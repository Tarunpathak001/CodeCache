// Test script to demonstrate PyPI caching functionality
// Run this after starting the server to see the PyPI cache in action

const axios = require('axios');

const SERVER_URL = 'http://localhost:5050';

async function testPypiCache() {
    console.log('🐍 Testing CodeCache Pro PyPI caching...\n');

    try {
        // Test 1: Download a popular Python package (will be a miss first time)
        console.log('📥 Test 1: Downloading requests package (first time - should be MISS)');
        try {
            // First get the package index to see available versions
            const indexResponse = await axios.get(`${SERVER_URL}/pypi/requests/`);
            console.log('✅ Successfully fetched requests package index');

            // Try to download a specific version (this will likely fail without a real PyPI setup, but will show the caching logic)
            console.log('📥 Attempting to download requests-2.31.0-py3-none-any.whl...');
            await axios.get(`${SERVER_URL}/pypi/requests/requests-2.31.0-py3-none-any.whl`);
        } catch (error) {
            console.log(`ℹ️  Expected error (PyPI package not found or network issue): ${error.response?.status || error.message}`);
        }

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Try another popular package
        console.log('📥 Test 2: Downloading numpy package index');
        try {
            const numpyResponse = await axios.get(`${SERVER_URL}/pypi/numpy/`);
            console.log('✅ Successfully fetched numpy package index');
        } catch (error) {
            console.log(`ℹ️  Expected error: ${error.response?.status || error.message}`);
        }

        // Test 3: Check server stats
        console.log('📊 Test 3: Checking server statistics');
        const statsResponse = await axios.get(`${SERVER_URL}/packet-stats`);
        const stats = statsResponse.data;

        console.log('\n📊 Current Server Statistics:');
        console.log(`   Total Requests: ${stats.hits + stats.misses}`);
        console.log(`   Cache Hits: ${stats.hits}`);
        console.log(`   Cache Misses: ${stats.misses}`);
        console.log(`   Hit Rate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}%`);

        if (stats.registryStats) {
            console.log('\n📈 Registry Breakdown:');
            stats.registryStats.forEach(registry => {
                console.log(`   ${registry.registry.toUpperCase()}: ${registry.package_count} packages, ${registry.total_hits} hits`);
            });
        }

        console.log('\n✅ PyPI cache test completed! Check the server console for real-time stats.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('Make sure the server is running on http://localhost:5050');
    }
}

// Helper function to test pip configuration
function showPipConfiguration() {
    console.log('\n🔧 To configure pip to use this cache server:');
    console.log('   pip config set global.index-url http://localhost:5050/pypi');
    console.log('\n🔧 To test with a real package:');
    console.log('   pip install --index-url http://localhost:5050/pypi requests');
    console.log('\n🔧 To revert to default PyPI:');
    console.log('   pip config unset global.index-url');
}

// Run the test
console.log('🚀 Starting PyPI cache tests...');
testPypiCache().then(() => {
    showPipConfiguration();
}).catch(console.error);