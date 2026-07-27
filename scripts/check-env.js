/**
 * Automated Environment Checker
 * Validates system requirements, directories, ports, Node.js runtime, and environment variables.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const REQUIRED_NODE_MAJOR = 18;
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);
const GENKIT_PORT = 4000;

function logCheck(name, success, message = '') {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} [${name}] ${message}`);
}

async function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function runEnvCheck() {
  console.log('====================================================');
  console.log(' 🔍 Workspace Automated Environment & System Check ');
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Node.js version check
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);
  if (majorVersion >= REQUIRED_NODE_MAJOR) {
    logCheck('Node.js Runtime', true, `Version ${nodeVersion} (>= v${REQUIRED_NODE_MAJOR})`);
  } else {
    logCheck('Node.js Runtime', false, `Version ${nodeVersion} is below required v${REQUIRED_NODE_MAJOR}`);
    allPassed = false;
  }

  // 2. Directory structure check
  const rootDir = process.cwd();
  const logsDir = path.join(rootDir, 'logs');
  const srcDir = path.join(rootDir, 'src');
  const nodeModulesDir = path.join(rootDir, 'node_modules');

  if (fs.existsSync(srcDir)) {
    logCheck('Source Directory', true, 'Found src/ directory');
  } else {
    logCheck('Source Directory', false, 'Missing src/ directory');
    allPassed = false;
  }

  if (fs.existsSync(nodeModulesDir)) {
    logCheck('Dependencies', true, 'node_modules directory present');
  } else {
    logCheck('Dependencies', false, 'node_modules directory missing. Run npm install.');
    allPassed = false;
  }

  // Ensure logs directory write access
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const testFile = path.join(logsDir, '.perm_test');
    fs.writeFileSync(testFile, 'test', 'utf8');
    fs.unlinkSync(testFile);
    logCheck('Logs Workspace', true, 'logs/ directory writable');
  } catch (err) {
    logCheck('Logs Workspace', false, `Cannot write to logs/ directory: ${err.message}`);
    allPassed = false;
  }

  // 3. Environment configuration file check
  const envPath = path.join(rootDir, '.env');
  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');

  if (fs.existsSync(envPath) || fs.existsSync(envLocalPath)) {
    logCheck('Environment Config', true, 'Found .env or .env.local file');
  } else if (fs.existsSync(envExamplePath)) {
    logCheck('Environment Config', true, 'Found .env.example (Copying to .env for fallback initialization)');
    fs.copyFileSync(envExamplePath, envPath);
  } else {
    logCheck('Environment Config', false, 'No .env file found');
  }

  // 4. Ports check
  const mainPortFree = await checkPortAvailable(DEFAULT_PORT);
  if (mainPortFree) {
    logCheck('Main App Port', true, `Port ${DEFAULT_PORT} is available`);
  } else {
    logCheck('Main App Port', true, `Port ${DEFAULT_PORT} is currently in use or active`);
  }

  const genkitPortFree = await checkPortAvailable(GENKIT_PORT);
  if (genkitPortFree) {
    logCheck('Genkit AI Port', true, `Port ${GENKIT_PORT} is available`);
  } else {
    logCheck('Genkit AI Port', true, `Port ${GENKIT_PORT} is currently in use or active`);
  }

  console.log('\n----------------------------------------------------');
  if (allPassed) {
    console.log('🎉 Environment checks PASSED. System ready for launch.');
    process.exit(0);
  } else {
    console.warn('⚠️ Some environment checks failed or require attention.');
    process.exit(1);
  }
}

runEnvCheck();
