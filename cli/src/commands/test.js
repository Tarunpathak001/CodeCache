// /cli/src/commands/test.js
// Purpose: Implements the 'test' command to run the stress test script.

const { execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

const backendDir = path.resolve(__dirname, '..', '..', '..', 'backend');

function runStressTest() {
    console.log(chalk.blue('Executing server stress test...'));
    try {
        execSync('npm run stress', { cwd: backendDir, stdio: 'inherit' });
    } catch (error) {
        console.error(chalk.red('\nStress test script finished with an error.'));
    }
}

module.exports = runStressTest;