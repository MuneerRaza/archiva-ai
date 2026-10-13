#!/usr/bin/env bash
# Start Archiva for local dev: Docker (MLflow/MinIO/pii-service) + backend + frontend.
# Live logs stream to this terminal AND to logs/backend.log + logs/frontend.log.
# Press Ctrl-C once to stop backend + frontend (Docker keeps running).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
mkdir -p logs

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# --- 1. Docker daemon ---------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  say "Starting Docker Desktop..."
  systemctl --user start docker-desktop
  until docker info >/dev/null 2>&1; do sleep 3; done
fi
say "Docker is up."

# --- 2. Docker services (MLflow + MinIO + pii-service) ------------------------
say "Starting MLflow, MinIO, and pii-service..."
docker compose up -d minio minio-setup mlflow-postgres mlflow pii-service

say "Waiting for pii-service (loads PII models on first start, can take 1-2 min)..."
until curl -sf http://localhost:8500/health >/dev/null 2>&1; do sleep 4; done
say "pii-service READY ✅   (MLflow: http://localhost:5000  MinIO: http://localhost:9001)"

# --- 3. Backend + frontend (native), logs to terminal + files -----------------
cleanup() {
  # Ignore further signals so a second Ctrl-C can't interrupt teardown — and so
  # the group-kill below doesn't take this script down before it exits cleanly.
  trap '' INT TERM
  say "Stopping backend + frontend... (Docker still running — 'docker compose down' to stop it)"
  # Signal the whole process group ($$ is the group leader), which reaches
  # uvicorn/pnpm AND their children (reload workers, node) — not just the
  # subshell wrappers. This is what makes a single Ctrl-C tear everything down.
  kill -TERM -- "-$$" 2>/dev/null
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

say "Starting backend on :8000  (logs/backend.log)"
( cd "$ROOT/backend" && uv run uvicorn app.main:app --reload --port 8000 2>&1 \
    | sed -u 's/^/[backend]  /' | tee "$ROOT/logs/backend.log" ) &

say "Starting frontend on :3000  (logs/frontend.log)"
( cd "$ROOT/frontend" && pnpm dev 2>&1 \
    | sed -u 's/^/[frontend] /' | tee "$ROOT/logs/frontend.log" ) &

say "All up. Open http://localhost:3000   (Ctrl-C to stop backend+frontend)"
wait
