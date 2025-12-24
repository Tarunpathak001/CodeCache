// /cli/src/commands/stats.js
// Purpose: Implements the 'stats' command to fetch and display cache statistics.

const axios = require('axios');
const Table = require('cli-table3');
const chalk = require('chalk');
const backendConfig = require('../../../backend/config'); // Load config to get port

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

async function showStats() {
    try {
        const response = await axios.get(`http://localhost:${backendConfig.port}/stats`);
        const stats = response.data;

        const table = new Table({
            head: [chalk.cyan('Metric'), chalk.cyan('Value')],
            colWidths: [30, 30]
        });

        const cacheUsage = (stats.cacheSizeBytes / stats.cacheSizeLimitBytes) * 100;

        table.push(
            ['Cache Hits', chalk.green(stats.hits.toLocaleString())],
            ['Cache Misses', chalk.yellow(stats.misses.toLocaleString())],
            ['Total Packages Cached', chalk.white(stats.numPackages.toLocaleString())],
            ['Bandwidth Saved', chalk.magenta(formatBytes(stats.bandwidthSaved))],
            ['Current Cache Size', chalk.white(`${formatBytes(stats.cacheSizeBytes)} / ${formatBytes(stats.cacheSizeLimitBytes)} (${cacheUsage.toFixed(2)}%)`)],
            ['Active Downloads', chalk.blue(stats.activeDownloads)],
            ['Peak Concurrency', chalk.blue(stats.peakConcurrency)]
        );

        console.log(chalk.bold.inverse(' CodeCache Pro Statistics '));
        console.log(table.toString());

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(chalk.red('❌ Error: Could not connect to the CodeCache Pro server. Is it running?'));
        } else {
            console.error(chalk.red(`❌ An error occurred: ${error.message}`));
        }
    }
}

module.exports = showStats;