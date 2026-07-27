#!/usr/bin/env bash
# ==============================================================================
# Workspace Automated Launch and Control System
# ==============================================================================
set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS_DIR="${WORKSPACE_DIR}/logs"
PID_FILE="${WORKSPACE_DIR}/.launch.pid"
SUPERVISOR_PID_FILE="${WORKSPACE_DIR}/.supervisor.pid"
GENKIT_PID_FILE="${WORKSPACE_DIR}/.genkit.pid"
PORT="${PORT:-5000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

mkdir -p "${LOGS_DIR}"

log_info() {
    echo -e "${GREEN}[LAUNCH]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_banner() {
    echo -e "${PURPLE}"
    echo "============================================================"
    echo " 🚀 Vibez Workspace Automated Logging & Launch System "
    echo "============================================================"
    echo -e "${NC}"
}

check_env() {
    log_info "Running automated pre-flight environment check..."
    node "${WORKSPACE_DIR}/scripts/check-env.js"
}

start_dev() {
    log_banner
    check_env
    log_info "Starting application in Development mode on port ${PORT}..."
    
    # Store PID of launched command
    exec npm run dev
}

start_prod() {
    log_banner
    check_env
    log_info "Building production Next.js assets..."
    npm run build:next
    
    log_info "Starting Production application on port ${PORT}..."
    exec npm run start -- --port "${PORT}" --hostname 0.0.0.0
}

start_daemon() {
    log_banner
    check_env
    
    if [ -f "${SUPERVISOR_PID_FILE}" ] && kill -0 $(cat "${SUPERVISOR_PID_FILE}") 2>/dev/null; then
        log_warn "Daemon is already running with Supervisor PID: $(cat "${SUPERVISOR_PID_FILE}")"
        exit 0
    fi

    log_info "Launching background process supervisor daemon..."
    nohup node "${WORKSPACE_DIR}/scripts/system-supervisor.js" "dev" "${PORT}" > "${LOGS_DIR}/supervisor.out" 2>&1 &
    
    SUPERVISOR_PID=$!
    echo "${SUPERVISOR_PID}" > "${SUPERVISOR_PID_FILE}"
    
    log_info "Supervisor daemon launched with PID: ${SUPERVISOR_PID}"
    log_info "Logs are being redirected to ${LOGS_DIR}/supervisor.out and ${LOGS_DIR}/launch.log"
}

start_genkit() {
    log_banner
    log_info "Starting Genkit AI Dev Server..."
    exec npm run genkit:dev
}

stop_all() {
    log_banner
    log_info "Stopping all application instances and supervisor daemons..."
    
    # Stop Supervisor
    if [ -f "${SUPERVISOR_PID_FILE}" ]; then
        SPID=$(cat "${SUPERVISOR_PID_FILE}")
        if kill -0 "${SPID}" 2>/dev/null; then
            log_info "Terminating Supervisor Process (PID: ${SPID})..."
            kill "${SPID}" 2>/dev/null || true
        fi
        rm -f "${SUPERVISOR_PID_FILE}"
    fi

    # Stop Main App PID
    if [ -f "${PID_FILE}" ]; then
        APID=$(cat "${PID_FILE}")
        if kill -0 "${APID}" 2>/dev/null; then
            log_info "Terminating App Process (PID: ${APID})..."
            kill "${APID}" 2>/dev/null || true
        fi
        rm -f "${PID_FILE}"
    fi

    # Kill any lingering node next dev / start processes on port 5000
    PIDS=$(lsof -ti:${PORT} 2>/dev/null || true)
    if [ -n "${PIDS}" ]; then
        log_info "Cleaning up lingering processes on port ${PORT}: ${PIDS}"
        kill -9 ${PIDS} 2>/dev/null || true
    fi

    log_info "✅ All services successfully stopped."
}

show_status() {
    log_banner
    echo -e "${CYAN}--- Process Status ---${NC}"
    
    if [ -f "${SUPERVISOR_PID_FILE}" ] && kill -0 $(cat "${SUPERVISOR_PID_FILE}") 2>/dev/null; then
        echo -e "Supervisor Daemon: ${GREEN}RUNNING${NC} (PID: $(cat "${SUPERVISOR_PID_FILE}"))"
    else
        echo -e "Supervisor Daemon: ${YELLOW}STOPPED${NC}"
    fi

    if [ -f "${PID_FILE}" ] && kill -0 $(cat "${PID_FILE}") 2>/dev/null; then
        echo -e "Application Process: ${GREEN}RUNNING${NC} (PID: $(cat "${PID_FILE}"))"
    else
        echo -e "Application Process: ${YELLOW}NOT RUNNING${NC}"
    fi

    echo -e "\n${CYAN}--- Port Binding ---${NC}"
    lsof -i:${PORT} 2>/dev/null || echo "No active processes listening on port ${PORT}."

    echo -e "\n${CYAN}--- Log Files Overview ---${NC}"
    node "${WORKSPACE_DIR}/scripts/log-cli.js" analyze
}

run_health() {
    log_banner
    log_info "Performing HTTP & API System Health Check..."
    curl -s "http://127.0.0.1:${PORT}/api/health" | JSON_PRETTY=1 node -e '
      let data = "";
      process.stdin.on("data", chunk => data += chunk);
      process.stdin.on("end", () => {
        try {
          console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch {
          console.log("Could not fetch health response. Is the application running on port '${PORT}'?");
        }
      });
    ' || log_error "Failed to reach health endpoint on port ${PORT}."
}

case "$1" in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    daemon)
        start_daemon
        ;;
    genkit)
        start_genkit
        ;;
    stop)
        stop_all
        ;;
    status)
        show_status
        ;;
    health)
        run_health
        ;;
    check-env)
        check_env
        ;;
    *)
        echo "Usage: $0 {dev|prod|daemon|genkit|stop|status|health|check-env}"
        exit 1
        ;;
esac
