#!/usr/bin/env bash
# Startup script launching Next.js dev server, logging stdout/stderr to ./logs/app.log and streaming to terminal via tee.
set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="${WORKSPACE_DIR}/logs"
LOG_FILE="${LOGS_DIR}/app.log"

mkdir -p "${LOGS_DIR}"

echo "============================================================"
echo " 🚀 Launching Next.js Dev Server (Output -> ${LOG_FILE}) "
echo "============================================================"

# Launch development server, combine stdout/stderr, and stream to file & terminal
npm run dev 2>&1 | tee -a "${LOG_FILE}"
