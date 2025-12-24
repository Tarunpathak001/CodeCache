// /cli/src/commands/stop.js
// Purpose: Implements the 'stop' command to halt the Windows service.

const { execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

const scriptsDir = path.resolve(__dirname, '..', '..', '..', 'scripts');

function stopService() {
    console.log(chalk.yellow('Attempting to stop the CodeCache Pro service...'));
    
    const uninstallScriptPath = path.join(scriptsDir, 'uninstall-service.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -Command "& '${uninstallScriptPath}' -StopOnly"`;
    
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(chalk.green('Service stop command executed.'));
    } catch (error) {
        console.error(chalk.red(`❌ Failed to stop service: ${error.message}`));
        console.error(chalk.red('Try running this from a PowerShell terminal as an Administrator.'));
    }
}

module.exports = stopService;