/**
 * System Supervisor & Daemon Runner
 * Supervises Next.js app and background services.
 * Features: Process monitoring, health checking, auto-restart on crash, PID tracking, and log redirection.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const PID_FILE = path.join(process.cwd(), '.launch.pid');
const SUPERVISOR_PID_FILE = path.join(process.cwd(), '.supervisor.pid');
const LAUNCH_LOG = path.join(LOGS_DIR, 'launch.log');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function writeLaunchLog(message, level = 'INFO') {
  ensureLogsDir();
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({
    timestamp,
    level,
    scope: 'Supervisor',
    message,
    environment: 'server',
  }) + '\n';
  fs.appendFileSync(LAUNCH_LOG, line, 'utf8');
  console.log(`[${timestamp}] [SUPERVISOR] [${level}] ${message}`);
}

class Supervisor {
  constructor(mode = 'dev', port = 5000, maxRestarts = 5) {
    this.mode = mode;
    this.port = port;
    this.maxRestarts = maxRestarts;
    this.restartCount = 0;
    this.childProcess = null;
    this.isShuttingDown = false;
  }

  start() {
    writeLaunchLog(`Starting supervisor in mode: ${this.mode} on port ${this.port}`);
    fs.writeFileSync(SUPERVISOR_PID_FILE, String(process.pid), 'utf8');

    this.registerSignalHandlers();
    this.spawnApp();
    this.startHealthMonitor();
  }

  spawnApp() {
    if (this.isShuttingDown) return;

    const command = 'npx';
    let args = [];

    if (this.mode === 'prod') {
      args = ['next', 'start', '-p', String(this.port), '-H', '0.0.0.0'];
    } else {
      args = ['next', 'dev', '--hostname', '0.0.0.0', '--port', String(this.port)];
    }

    writeLaunchLog(`Spawning application: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(this.port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.childProcess = child;
    fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
    writeLaunchLog(`Application process spawned with PID: ${child.pid}`);

    child.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        writeLaunchLog(`[App Output] ${output}`, 'DEBUG');
      }
    });

    child.stderr.on('data', (data) => {
      const errorOutput = data.toString().trim();
      if (errorOutput) {
        writeLaunchLog(`[App Stderr] ${errorOutput}`, 'WARN');
      }
    });

    child.on('exit', (code, signal) => {
      writeLaunchLog(`Application process ${child.pid} exited with code ${code}, signal ${signal}`, code === 0 ? 'INFO' : 'ERROR');

      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }

      if (!this.isShuttingDown) {
        if (this.restartCount < this.maxRestarts) {
          this.restartCount++;
          writeLaunchLog(`Attempting auto-restart (${this.restartCount}/${this.maxRestarts}) in 3 seconds...`, 'WARN');
          setTimeout(() => this.spawnApp(), 3000);
        } else {
          writeLaunchLog(`Maximum restart limit (${this.maxRestarts}) reached. Supervisor giving up.`, 'FATAL');
          process.exit(1);
        }
      }
    });
  }

  startHealthMonitor() {
    setInterval(() => {
      if (this.isShuttingDown || !this.childProcess) return;

      const req = http.get(`http://127.0.0.1:${this.port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          if (this.restartCount > 0) {
            writeLaunchLog('App health check passed. Resetting restart counter.');
            this.restartCount = 0;
          }
        }
      });

      req.on('error', () => {
        // App might still be booting up
      });

      req.setTimeout(3000, () => req.destroy());
    }, 15000);
  }

  registerSignalHandlers() {
    const shutdown = (signal) => {
      writeLaunchLog(`Received ${signal}. Shutting down supervised application...`);
      this.isShuttingDown = true;

      if (this.childProcess) {
        this.childProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.childProcess) this.childProcess.kill('SIGKILL');
        }, 5000);
      }

      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      if (fs.existsSync(SUPERVISOR_PID_FILE)) fs.unlinkSync(SUPERVISOR_PID_FILE);

      writeLaunchLog('Supervisor shutdown complete.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

const mode = process.argv[2] || 'dev';
const port = parseInt(process.argv[3] || '5000', 10);

const supervisor = new Supervisor(mode, port);
supervisor.start();
