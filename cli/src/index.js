#!/usr/bin/env node
// /cli/src/index.js
// Purpose: Entry point for the command-line interface, using Commander.js to define commands.

const { program } = require('commander');
const { startServer, startService } = require('./commands/start');
const stopService = require('./commands/stop');
const showStats = require('./commands/stats');
const clearCache = require('./commands/clear');
const runStressTest = require('./commands/test');

program
    .name('codecache')
    .description('CLI for managing the CodeCache Pro server');

program
    .command('start')
    .description('Start the CodeCache Pro server in the foreground')
    .action(startServer);

program
    .command('start-service')
    .description('Install and start CodeCache Pro as a Windows service')
    .action(startService);

program
    .command('stop')
    .description('Stop the foreground server or the Windows service')
    .action(stopService);

program
    .command('stats')
    .description('Display current cache statistics')
    .action(showStats);

program
    .command('clear')
    .description('Clear the entire package cache')
    .action(clearCache);
    
program
    .command('test')
    .description('Run a stress test against the server')
    .action(runStressTest);

program.parse(process.argv);