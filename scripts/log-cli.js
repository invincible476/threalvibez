/**
 * Workspace Automated Log CLI & Diagnostics Tool
 * Usage:
 *   node scripts/log-cli.js tail [--lines=50] [--level=error|warn|info|debug] [--file=app|error|combined|access|launch]
 *   node scripts/log-cli.js analyze
 *   node scripts/log-cli.js rotate [--max-size-mb=5]
 *   node scripts/log-cli.js clean [--keep-days=7]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOGS_DIR = path.join(process.cwd(), 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'tail';
  const options = {};

  args.slice(1).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      options[key] = val !== undefined ? val : true;
    }
  });

  return { command, options };
}

// ----------------------------------------------------
// 1. TAIL COMMAND
// ----------------------------------------------------
function tailLogs(options) {
  ensureLogsDir();
  const fileType = options.file || 'combined';
  const fileName = `${fileType.replace(/\.log$/, '')}.log`;
  const filePath = path.join(LOGS_DIR, fileName);
  const limit = parseInt(options.lines || '50', 10);
  const targetLevel = options.level ? options.level.toLowerCase() : null;

  if (!fs.existsSync(filePath)) {
    console.log(`ℹ️ Log file ${fileName} does not exist yet at ${filePath}.`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.trim().split('\n').filter(Boolean);

  console.log(`\n====================================================`);
  console.log(` 📋 Viewing last ${limit} log entries from ${fileName}`);
  if (targetLevel) console.log(` 🎯 Filtered level: ${targetLevel.toUpperCase()}`);
  console.log(`====================================================\n`);

  const parsedLogs = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line, timestamp: new Date().toISOString(), level: 'info', scope: 'Raw' };
      }
    })
    .filter((entry) => {
      if (!targetLevel) return true;
      return entry.level && entry.level.toLowerCase() === targetLevel;
    });

  const slice = parsedLogs.slice(-limit);

  slice.forEach((entry) => {
    const timestamp = entry.timestamp || entry.receivedAt || new Date().toISOString();
    const level = (entry.level || 'info').toUpperCase();
    const scope = entry.scope || 'System';
    const msg = entry.message || JSON.stringify(entry);

    let prefixColor = '';
    if (level === 'ERROR' || level === 'FATAL') prefixColor = '\x1b[31m';
    else if (level === 'WARN') prefixColor = '\x1b[33m';
    else if (level === 'INFO') prefixColor = '\x1b[32m';
    else prefixColor = '\x1b[36m';
    const reset = '\x1b[0m';

    console.log(`${prefixColor}[${timestamp}] [${level}] [${scope}]${reset} ${msg}`);
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      console.log(`  └─ Meta:`, JSON.stringify(entry.meta));
    }
    if (entry.error) {
      console.log(`  └─ Error:`, entry.error.message || entry.error);
      if (entry.error.stack) console.log(`     Stack: ${entry.error.stack.split('\n')[0]}`);
    }
  });

  console.log(`\nTotal displayed: ${slice.length} logs.\n`);
}

// ----------------------------------------------------
// 2. ANALYZE COMMAND
// ----------------------------------------------------
function analyzeLogs() {
  ensureLogsDir();
  console.log('\n====================================================');
  console.log(' 📊 Workspace Log & Error Analytics Report');
  console.log('====================================================\n');

  const files = fs.readdirSync(LOGS_DIR).filter((f) => f.endsWith('.log'));

  if (files.length === 0) {
    console.log('ℹ️ No log files found in logs/ directory.');
    return;
  }

  let totalEntries = 0;
  const levelCounts = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
  const scopeCounts = {};
  const topErrors = {};
  let totalLatencyMs = 0;
  let accessCount = 0;

  files.forEach((file) => {
    const filePath = path.join(LOGS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    lines.forEach((line) => {
      try {
        const entry = JSON.parse(line);
        totalEntries++;

        if (entry.level && levelCounts[entry.level.toLowerCase()] !== undefined) {
          levelCounts[entry.level.toLowerCase()]++;
        }

        if (entry.scope) {
          scopeCounts[entry.scope] = (scopeCounts[entry.scope] || 0) + 1;
        }

        if (entry.error || entry.level === 'error' || entry.level === 'fatal') {
          const errMsg = entry.error?.message || entry.message || 'Unknown error';
          topErrors[errMsg] = (topErrors[errMsg] || 0) + 1;
        }

        if (entry.durationMs) {
          totalLatencyMs += entry.durationMs;
          accessCount++;
        }
      } catch {
        // Raw line
        totalEntries++;
      }
    });
  });

  console.log(`📂 Log Files Tracked (${files.length}):`);
  files.forEach((f) => {
    const stat = fs.statSync(path.join(LOGS_DIR, f));
    console.log(`  - ${f.padEnd(16)} ${(stat.size / 1024).toFixed(2)} KB`);
  });

  console.log(`\n📈 Summary Metrics:`);
  console.log(`  Total Log Lines:    ${totalEntries}`);
  console.log(`  Errors / Fatal:     ${levelCounts.error + levelCounts.fatal}`);
  console.log(`  Warnings:           ${levelCounts.warn}`);
  console.log(`  Info Logs:          ${levelCounts.info}`);
  console.log(`  Debug/Trace:        ${levelCounts.debug + levelCounts.trace}`);

  if (accessCount > 0) {
    console.log(`  Avg HTTP Latency:   ${(totalLatencyMs / accessCount).toFixed(2)} ms (${accessCount} requests tracked)`);
  }

  console.log(`\n🔥 Top Scope Activity:`);
  Object.entries(scopeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([scope, count]) => {
      console.log(`  - ${scope.padEnd(20)}: ${count} events`);
    });

  if (Object.keys(topErrors).length > 0) {
    console.log(`\n🚨 Most Frequent Error Messages:`);
    Object.entries(topErrors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([errMsg, count]) => {
        console.log(`  - [${count}x] ${errMsg}`);
      });
  } else {
    console.log('\n✨ No recorded error events in logs.');
  }

  console.log('\n----------------------------------------------------\n');
}

// ----------------------------------------------------
// 3. ROTATE COMMAND
// ----------------------------------------------------
function rotateLogs(options) {
  ensureLogsDir();
  const maxSizeBytes = (parseFloat(options['max-size-mb'] || '5')) * 1024 * 1024;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  console.log(`🔄 Checking log files for rotation (> ${options['max-size-mb'] || 5} MB)...`);

  const files = fs.readdirSync(LOGS_DIR).filter((f) => f.endsWith('.log') && !f.includes('.bak'));
  let rotatedCount = 0;

  files.forEach((file) => {
    const filePath = path.join(LOGS_DIR, file);
    const stat = fs.statSync(filePath);

    if (stat.size >= maxSizeBytes || options.force) {
      const backupPath = path.join(LOGS_DIR, `${path.basename(file, '.log')}_${timestamp}.log.bak`);
      fs.renameSync(filePath, backupPath);
      fs.writeFileSync(filePath, '', 'utf8');
      console.log(`✅ Rotated ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB) -> ${path.basename(backupPath)}`);
      rotatedCount++;
    }
  });

  if (rotatedCount === 0) {
    console.log('ℹ️ All log files are within acceptable size limits. No rotation needed.');
  }
}

// ----------------------------------------------------
// 4. CLEAN COMMAND
// ----------------------------------------------------
function cleanLogs(options) {
  ensureLogsDir();
  const keepDays = parseInt(options['keep-days'] || '7', 10);
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  console.log(`🧹 Cleaning archived log backups older than ${keepDays} days...`);

  const files = fs.readdirSync(LOGS_DIR).filter((f) => f.endsWith('.bak'));
  let deletedCount = 0;

  files.forEach((file) => {
    const filePath = path.join(LOGS_DIR, file);
    const stat = fs.statSync(filePath);

    if (stat.mtimeMs < cutoffTime) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Removed old backup log: ${file}`);
      deletedCount++;
    }
  });

  console.log(`✨ Cleanup complete. Removed ${deletedCount} expired backup log files.`);
}

// ----------------------------------------------------
// MAIN ROUTER
// ----------------------------------------------------
function main() {
  const { command, options } = parseArgs();

  switch (command) {
    case 'tail':
      tailLogs(options);
      break;
    case 'analyze':
      analyzeLogs();
      break;
    case 'rotate':
      rotateLogs(options);
      break;
    case 'clean':
      cleanLogs(options);
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log(`Supported commands: tail, analyze, rotate, clean`);
      process.exit(1);
  }
}

main();
