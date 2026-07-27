/**
 * Workspace Centralized Logger System
 * Supports environment-aware logging for both Server (Node.js) and Client (Browser).
 * Includes log levels, context scoping, structured output, and server-side log file persistence.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVEL_MAP: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  environment: 'server' | 'browser';
  requestId?: string;
}

export interface LoggerOptions {
  scope?: string;
  minLevel?: LogLevel;
}

// Default minimum log level from env or debug/info
const getMinLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && envLevel in LOG_LEVEL_MAP) {
    return envLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

class Logger {
  private scope: string;
  private minLevel: LogLevel;
  private isServer: boolean;

  constructor(options: LoggerOptions = {}) {
    this.scope = options.scope || 'App';
    this.minLevel = options.minLevel || getMinLogLevel();
    this.isServer = typeof window === 'undefined';
  }

  /**
   * Create a child logger with a sub-scope
   */
  public child(scope: string): Logger {
    const newScope = this.scope ? `${this.scope}:${scope}` : scope;
    return new Logger({ scope: newScope, minLevel: this.minLevel });
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_MAP[level] >= LOG_LEVEL_MAP[this.minLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    err?: Error | unknown
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      scope: this.scope,
      message,
      environment: this.isServer ? 'server' : 'browser',
    };

    if (meta && Object.keys(meta).length > 0) {
      entry.meta = meta;
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
      } else {
        entry.error = {
          message: String(err),
        };
      }
    }

    return entry;
  }

  private writeLog(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return;

    // 1. Console Output
    const colorMap: Record<LogLevel, string> = {
      trace: '\x1b[90m', // Gray
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m', // Magenta
    };
    const resetColor = '\x1b[0m';

    if (this.isServer) {
      const color = colorMap[entry.level] || resetColor;
      const formattedConsole = `${color}[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}]${resetColor} ${entry.message}`;

      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(formattedConsole, entry.meta || '', entry.error || '');
      } else if (entry.level === 'warn') {
        console.warn(formattedConsole, entry.meta || '');
      } else {
        console.log(formattedConsole, entry.meta || '');
      }

      // Write to log file if running in Node.js server context
      this.writeToServerFile(entry);
    } else {
      // Browser environment console
      const badgeStyle = `padding: 2px 6px; border-radius: 3px; font-weight: bold;`;
      const levelStyles: Record<LogLevel, string> = {
        trace: `${badgeStyle} background: #6c757d; color: white;`,
        debug: `${badgeStyle} background: #17a2b8; color: white;`,
        info: `${badgeStyle} background: #28a745; color: white;`,
        warn: `${badgeStyle} background: #ffc107; color: black;`,
        error: `${badgeStyle} background: #dc3545; color: white;`,
        fatal: `${badgeStyle} background: #6f42c1; color: white;`,
      };

      const consoleArgs = [
        `%c${entry.level.toUpperCase()}%c [${entry.scope}] ${entry.message}`,
        levelStyles[entry.level],
        'color: inherit;',
      ];

      if (entry.meta) consoleArgs.push(entry.meta as unknown as string);
      if (entry.error) consoleArgs.push(entry.error as unknown as string);

      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(...consoleArgs);
        this.sendClientLogToServer(entry);
      } else if (entry.level === 'warn') {
        console.warn(...consoleArgs);
      } else {
        console.log(...consoleArgs);
      }
    }
  }

  private writeToServerFile(entry: LogEntry) {
    try {
      // Dynamic import fs to prevent issues in edge/browser runtimes
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');

      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const jsonLine = JSON.stringify(entry) + '\n';
      const targetFile = entry.level === 'error' || entry.level === 'fatal'
        ? path.join(logsDir, 'error.log')
        : path.join(logsDir, 'app.log');

      fs.appendFileSync(targetFile, jsonLine, 'utf8');

      // Also append all logs to master combined file
      fs.appendFileSync(path.join(logsDir, 'combined.log'), jsonLine, 'utf8');
    } catch {
      // Ignore file writing errors on read-only environments
    }
  }

  private sendClientLogToServer(entry: LogEntry) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        keepalive: true,
      }).catch(() => {
        // Silent catch for telemetry delivery failure
      });
    } catch {
      // Ignore client transport failures
    }
  }

  public trace(message: string, meta?: Record<string, unknown>) {
    this.writeLog(this.createLogEntry('trace', message, meta));
  }

  public debug(message: string, meta?: Record<string, unknown>) {
    this.writeLog(this.createLogEntry('debug', message, meta));
  }

  public info(message: string, meta?: Record<string, unknown>) {
    this.writeLog(this.createLogEntry('info', message, meta));
  }

  public warn(message: string, meta?: Record<string, unknown>) {
    this.writeLog(this.createLogEntry('warn', message, meta));
  }

  public error(message: string, err?: Error | unknown, meta?: Record<string, unknown>) {
    this.writeLog(this.createLogEntry('error', message, meta, err));
  }

  public fatal(message: string, err?: Error | unknown, meta?: Record<string, unknown>) {
    this.writeLog(this.createLogEntry('fatal', message, meta, err));
  }
}

export const logger = new Logger({ scope: 'Vibez' });
export function createLogger(scope: string): Logger {
  return new Logger({ scope });
}
