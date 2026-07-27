/**
 * Continuous Auth System Monitoring & Testing Loop
 * Periodically executes E2E auth tests, checks system health, inspects logs, and reports metrics.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 5000;
const LOGS_DIR = path.join(process.cwd(), 'logs');
const MONITOR_LOG = path.join(LOGS_DIR, 'auth-monitor.log');

function logMonitor(message, level = 'INFO') {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  const timestamp = new Date().toISOString();
  const entry = JSON.stringify({
    timestamp,
    level,
    scope: 'AuthMonitor',
    message,
    environment: 'server',
  }) + '\n';

  fs.appendFileSync(MONITOR_LOG, entry, 'utf8');
  fs.appendFileSync(path.join(LOGS_DIR, 'combined.log'), entry, 'utf8');
  console.log(`[${timestamp}] [AUTH_MONITOR] [${level}] ${message}`);
}

async function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: res.statusCode === 200, data: parsed });
        } catch {
          resolve({ ok: false, data: null });
        }
      });
    });

    req.on('error', () => resolve({ ok: false, data: null }));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ ok: false, data: null });
    });
  });
}

function runE2ETests() {
  try {
    const output = execSync(`node scripts/test-auth-e2e.js`, { encoding: 'utf8' });
    logMonitor('E2E Auth Test Suite executed successfully.', 'INFO');
    return true;
  } catch (err) {
    logMonitor(`E2E Auth Test Suite failed: ${err.message}`, 'ERROR');
    return false;
  }
}

function analyzeAuthLogs() {
  const errorLogPath = path.join(LOGS_DIR, 'error.log');
  if (!fs.existsSync(errorLogPath)) return;

  const content = fs.readFileSync(errorLogPath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  const authErrors = lines.filter(
    (line) => line.includes('auth/') || line.includes('AuthError') || line.includes('FirebaseError')
  );

  if (authErrors.length > 0) {
    logMonitor(`Detected ${authErrors.length} auth-related error log entries in error.log`, 'WARN');
  }
}

async function startMonitorLoop(once = false, intervalMs = 60000) {
  logMonitor(`Starting Auth System Monitoring Loop (Interval: ${intervalMs / 1000}s, Once: ${once})`);

  let loopCount = 0;

  async function executeCycle() {
    loopCount++;
    logMonitor(`--- Monitoring Cycle #${loopCount} ---`);

    // 1. Health Check
    const health = await checkHealth();
    if (health.ok) {
      logMonitor(`Health Check: PASSED (Uptime: ${health.data.uptimeSeconds.toFixed(0)}s, RSS: ${health.data.memory.rssMB}MB)`);
    } else {
      logMonitor('Health Check: FAILED (Server unresponsive or returning non-200 on /api/health)', 'WARN');
    }

    // 2. Run E2E Test Suite
    if (health.ok) {
      runE2ETests();
    }

    // 3. Inspect Error Logs
    analyzeAuthLogs();

    logMonitor(`--- Cycle #${loopCount} Finished ---\n`);
  }

  await executeCycle();

  if (!once) {
    setInterval(async () => {
      await executeCycle();
    }, intervalMs);
  }
}

const isOnce = process.argv.includes('--once');
startMonitorLoop(isOnce);
