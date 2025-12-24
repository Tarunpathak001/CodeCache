// /cli/src/commands/start.js
// Purpose: Implements the 'start' and 'start-service' commands.

const { exec, execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

const backendDir = path.resolve(__dirname, '..', '..', '..', 'backend');
const scriptsDir = path.resolve(__dirname, '..', '..', '..', 'scripts');

function startServer() {
    console.log(chalk.green('Starting CodeCache Pro server in foreground...'));
    console.log(chalk.yellow('Press Ctrl+C to stop.'));
    try {
        execSync('npm start', { cwd: backendDir, stdio: 'inherit' });
    } catch (error) {
        // This catch block will likely execute after Ctrl+C, which is expected.
        console.log(chalk.red('\nServer stopped.'));
    }
}

function startService() {
    console.log(chalk.green('Attempting to install and start the Windows service...'));
    console.log(chalk.yellow('This requires Administrator privileges. You may see a UAC prompt.'));
    
    const installScriptPath = path.join(scriptsDir, 'install-service.ps1');

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${installScriptPath}"`;

    try {
        execSync(command, { stdio: 'inherit' });
        console.log(chalk.greenBright('\n✅ Service installation script completed.'));
    } catch (error) {
        console.error(chalk.red(`\n❌ Service installation failed: ${error.message}`));
        console.error(chalk.red('Please try running PowerShell as an Administrator and execute the script manually.'));
    }
}

module.exports = { startServer, startService };