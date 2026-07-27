#!/usr/bin/env bash
# ==============================================================================
# Log Rotation & Maintenance Script
# Cleans and archives log files older than 7 days in ./logs
# ==============================================================================
set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS_DIR="${WORKSPACE_DIR}/logs"
RETENTION_DAYS=7

mkdir -p "${LOGS_DIR}"

echo "============================================================"
echo " 🔄 Running Log Maintenance & Rotation (> ${RETENTION_DAYS} days) "
echo "============================================================"

# 1. Rotate current app.log if size exceeds 5MB
APP_LOG="${LOGS_DIR}/app.log"
if [ -f "${APP_LOG}" ]; then
    SIZE_KB=$(du -k "${APP_LOG}" | cut -f1)
    if [ "${SIZE_KB}" -gt 5120 ]; then
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        echo "[ROTATE] Rotating app.log (${SIZE_KB} KB) -> app_${TIMESTAMP}.log.bak"
        mv "${APP_LOG}" "${LOGS_DIR}/app_${TIMESTAMP}.log.bak"
        touch "${APP_LOG}"
    fi
fi

# 2. Archive or clean backup/log files older than 7 days
echo "[CLEANUP] Searching for log archives older than ${RETENTION_DAYS} days..."

DELETED_COUNT=0
find "${LOGS_DIR}" -type f \( -name "*.bak" -o -name "*.log" \) -mtime +${RETENTION_DAYS} -print0 | while IFS= read -r -d '' file; do
    echo "[REMOVING] ${file}"
    rm -f "${file}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

echo "✅ Log maintenance complete. Expired log cleanup finished."
