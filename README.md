# Vibez - Real-time Communication & Media Platform

Vibez is a modern real-time messaging, AI smart reply, and media sharing application built with Next.js, Firebase, and Genkit AI.

---

## 🚀 Quick Launch System

This repository is equipped with an automated Logging and Launch System for continuous monitoring, process supervision, health checks, and log management.

### Environment Pre-flight Check
```bash
npm run launch:check-env
```

### Launch Modes
- **Development Mode**: `npm run launch:dev` (or `./scripts/launch.sh dev`)
- **Production Mode**: `npm run launch:prod` (or `./scripts/launch.sh prod`)
- **Background Daemon Mode**: `npm run launch:daemon` (or `./scripts/launch.sh daemon`)
- **Genkit AI Server**: `npm run launch:genkit` (or `./scripts/launch.sh genkit`)
- **Stop All Instances**: `npm run launch:stop` (or `./scripts/launch.sh stop`)
- **Process Status**: `npm run launch:status` (or `./scripts/launch.sh status`)
- **System Health Check**: `npm run launch:health` (or `./scripts/launch.sh health`)

---

## 📊 Automated Logging & Diagnostics System

Logs are automatically stored, formatted, and categorized in the `logs/` directory.

### Log Management Commands
- **Stream Logs**: `npm run logs:tail` (Optional: `--level=error`, `--file=app`, `--lines=100`)
- **Analyze Logs & Metrics**: `npm run logs:analyze`
- **Rotate Large Log Files**: `npm run logs:rotate` (Optional: `--max-size-mb=5`)
- **Clean Expired Archives**: `npm run logs:clean` (Optional: `--keep-days=7`)

### System Architecture Documentation
For complete details on the logging architecture, process supervisor, API endpoints (`/api/health`, `/api/logs`), and client-side error boundary, see [LOGGING_AND_LAUNCH.md](file:///workspaces/threalvibez/docs/LOGGING_AND_LAUNCH.md).
