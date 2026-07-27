# Automated Logging and Launch System Documentation

## Architecture Overview

The workspace features a complete, self-monitoring **Automated Logging and Launch System** designed to streamline development, background daemon execution, error telemetry, process supervision, and log lifecycle management.

```
                  ┌──────────────────────────────────────────────┐
                  │              Control & CLI                   │
                  │   npm run launch / scripts/launch.sh        │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
   ┌────────────────────────────┐                 ┌─────────────────────────────┐
   │    Process Supervisor      │                 │  Central Logger & Middleware│
   │ scripts/system-supervisor  │                 │   src/lib/logger/index.ts   │
   └─────────────┬──────────────┘                 │      src/middleware.ts      │
                 │                                └──────────────┬──────────────┘
                 │ (Monitor/Auto-restart)                        │ (Structured Logs)
                 ▼                                               ▼
   ┌────────────────────────────┐                 ┌─────────────────────────────┐
   │    Next.js Web Server      │────────────────►│       logs/ Directory       │
   │  (/api/health, /api/logs)  │  Write Logs     │ app.log, error.log, etc.    │
   └────────────────────────────┘                 └──────────────┬──────────────┘
                                                                 │
                                                                 ▼
                                                  ┌─────────────────────────────┐
                                                  │       Log CLI & Tail        │
                                                  │     scripts/log-cli.js      │
                                                  └─────────────────────────────┘
```

---

## Key Components

### 1. Centralized Application Logger (`src/lib/logger/index.ts`)
- **Universal compatibility**: Works seamlessly in both Node.js server and Browser client environments.
- **Log Levels**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
- **Structured JSON & Formatted Console**: Color-coded, high-visibility output in development; machine-readable JSON lines in log files.
- **Server Persistence**: Automatically appends logs to `logs/app.log`, `logs/error.log`, and `logs/combined.log`.
- **Client Telemetry**: Captures client errors and automatically transmits them via fetch to `/api/logs`.

### 2. Client Ingestion & System Health Endpoints
- **`/api/logs` (`src/app/api/logs/route.ts`)**: Ingests browser error events and stores them in `logs/client.log` and `logs/error.log`.
- **`/api/health` (`src/app/api/health/route.ts`)**: Reports real-time system metrics including process uptime, memory RSS/heap usage, log file sizes, and environment status.

### 3. HTTP Access Middleware (`src/middleware.ts`)
- Automatically intercepts incoming HTTP requests, assigns a unique `x-request-id`, records status codes, route paths, client IP addresses, and response latency.

### 4. Client Error Boundary (`src/components/error-boundary.tsx`)
- React Error Boundary component that intercepts React component failures, logs error stacks with `logger.error`, and renders a graceful recovery UI.

### 5. Automated Process Supervisor (`scripts/system-supervisor.js`)
- Background daemon supervisor that manages Node.js application process lifecycle.
- Automatically restarts the application on unexpected exits (up to configured max restart limits).
- Periodically pings `/api/health` to verify service responsiveness.
- Manages `.launch.pid` and `.supervisor.pid` tracking files.

### 6. Command-Line Launch Interface (`scripts/launch.sh`)
- Executable bash script managing all launch lifecycle operations:
  - `dev`: Pre-flight environment check + dev server.
  - `prod`: Pre-flight environment check + build + production server.
  - `daemon`: Supervisor daemon in background mode.
  - `genkit`: Starts Genkit AI server.
  - `stop`: Gracefully terminates all processes and cleans up PIDs.
  - `status`: Displays active PIDs, port bindings, and log file metrics.
  - `health`: Executes curl check against `/api/health`.

### 7. Log Management CLI (`scripts/log-cli.js`)
- `tail`: Stream and filter logs by severity or file.
- `analyze`: Generates analytical summaries of total log entries, top error messages, request latencies, and file sizes.
- `rotate`: Rotates files larger than threshold (default 5MB) into `.bak` archives.
- `clean`: Purges backup files older than retention policy (default 7 days).

---

## Usage Guide & Commands

| Command | Action | Description |
| :--- | :--- | :--- |
| `npm run launch` | Development | Run env check and launch development server |
| `npm run launch:dev` | Development | Run env check and launch development server |
| `npm run launch:prod` | Production | Run env check, build Next.js app, launch production server |
| `npm run launch:daemon` | Background Daemon | Launch supervisor daemon in background |
| `npm run launch:genkit` | Genkit AI | Start Genkit developer server |
| `npm run launch:stop` | Termination | Stop all running processes and daemons |
| `npm run launch:status` | Status | Display active processes, PIDs, ports, log sizes |
| `npm run launch:health` | Health Check | Query internal `/api/health` diagnostic endpoint |
| `npm run launch:check-env` | Pre-flight | Check Node.js version, folders, ports, env files |
| `npm run logs:tail` | Log Viewer | View/tail recent log entries |
| `npm run logs:analyze` | Analytics | Generate log analytics and error frequency report |
| `npm run logs:rotate` | Maintenance | Rotate log files exceeding max size |
| `npm run logs:clean` | Maintenance | Remove expired log archives |

---

## Verification & Testing

All system components have been validated with TypeScript typechecks, CLI execution tests, and health endpoint verifications.
