// /cli/src/commands/clear.js
// Purpose: Implements the 'clear' command to wipe the cache.

const axios = require('axios');
const chalk = require('chalk');
const backendConfig = require('../../../backend/config');

async function clearCache() {
    try {
        console.log(chalk.yellow('Sending request to clear the cache...'));
        await axios.post(`http://localhost:${backendConfig.port}/clear-cache`);
        console.log(chalk.green('✅ Cache has been cleared successfully.'));
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(chalk.red('❌ Error: Could not connect to the CodeCache Pro server. Is it running?'));
        } else {
            console.error(chalk.red(`❌ An error occurred: ${error.message}`));
        }
    }
}

module.exports = clearCache;