


const axios = require('axios');
const config = require('../config');

const CONCURRENT_REQUESTS = 50;
const TARGET_PACKAGE = 'is-odd'; // A very small, common package
const SERVER_URL = `http://localhost:${config.port}/npm/${TARGET_PACKAGE}/-/is-odd-3.0.1.tgz`;

async function runTest() {
    console.log(`🚀 Starting stress test with ${CONCURRENT_REQUESTS} concurrent requests...`);
    
    // Clear the cache for this package first to test the 'miss' scenario
    try {
        console.log(`Attempting to clear cache via API...`);
        // This is a simple way, a better test would selectively delete the package from DB/disk
        await axios.post(`http://localhost:${config.port}/clear-cache`);
        console.log('Cache cleared.');
    } catch (e) {
        console.error('Could not clear cache. Test will likely measure cache hits.', e.message);
    }

    const requests = [];
    const timings = [];
    let successCount = 0;
    let failureCount = 0;

    const startTime = Date.now();

    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        const requestPromise = (async () => {
            const requestStartTime = Date.now();
            try {
                const response = await axios.get(SERVER_URL, { responseType: 'arraybuffer' });
                if (response.status === 200 && response.data.length > 0) {
                    successCount++;
                } else {
                    failureCount++;
                }
            } catch (error) {
                console.error(`Request failed: ${error.message}`);
                failureCount++;
            } finally {
                const requestEndTime = Date.now();
                timings.push(requestEndTime - requestStartTime);
            }
        })();
        requests.push(requestPromise);
    }

    await Promise.all(requests);
    const endTime = Date.now();

    console.log('\n--- Stress Test Results ---');
    console.log(`Total Time: ${(endTime - startTime) / 1000}s`);
    console.log(`Successful Requests: ${successCount}`);
    console.log(`Failed Requests: ${failureCount}`);

    if (timings.length > 0) {
        const avgLatency = timings.reduce((a, b) => a + b, 0) / timings.length;
        console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    }

    try {
        const statsResponse = await axios.get(`http://localhost:${config.port}/stats`);
        console.log(`\nServer stats after test:`);
        console.log(`  - Peak Concurrency Reached: ${statsResponse.data.peakConcurrency}`);
        console.log(`  - Hits: ${statsResponse.data.hits}`);
        console.log(`  - Misses: ${statsResponse.data.misses}`);
    } catch (e) {
        console.error('Could not fetch server stats.');
    }

    if (failureCount > 0) {
        console.error("\n❌ Test finished with failures.");
        process.exit(1);
    } else {
        console.log("\n✅ Test completed successfully!");
        process.exit(0);
    }
}

runTest();