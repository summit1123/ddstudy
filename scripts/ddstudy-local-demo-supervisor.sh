#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="${DDSTUDY_ROOT:-/Users/gimdonghyeon/Desktop/live2d/nnnnnrrrrrin}"
LOG_DIR="${DDSTUDY_LOG_DIR:-/tmp/ddstudy-deploy-logs}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-/opt/homebrew/bin/cloudflared}"
CLOUDFLARED_TOKEN_FILE="${CLOUDFLARED_TOKEN_FILE:-$HOME/.cloudflared/summit1123.token}"
APP_PORT="${DDSTUDY_APP_PORT:-3005}"
PUBLIC_HOSTNAME="${DDSTUDY_PUBLIC_HOSTNAME:-ddstudy.summit1123.co.kr}"
CHECK_INTERVAL_SEC="${DDSTUDY_CHECK_INTERVAL_SEC:-20}"
DATABASE_URL="${DATABASE_URL:-postgresql://daeum:daeum@127.0.0.1:5433/daeum_hangeoreum}"
RAG_VECTOR_BACKEND="${RAG_VECTOR_BACKEND:-pgvector}"

mkdir -p "$LOG_DIR"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_DIR/supervisor.log"
}

network_ready() {
  curl -fsS --max-time 5 https://www.cloudflare.com/cdn-cgi/trace >/dev/null 2>&1
}

port_ready() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

local_health_ready() {
  curl -fsS --max-time 8 "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1
}

public_health_ready() {
  curl -fsS --max-time 12 "https://$PUBLIC_HOSTNAME/api/health" >/dev/null 2>&1
}

screen_ready() {
  screen -ls 2>/dev/null | grep -q "[.]$1[[:space:]]"
}

tunnel_ready() {
  pgrep -f "cloudflared tunnel .*run --token-file .*summit1123[.]token" >/dev/null 2>&1
}

start_pgvector() {
  if port_ready 5433; then
    return
  fi
  log "starting pgvector on :5433"
  (
    cd "$ROOT_DIR" || exit 1
    docker compose -f docker-compose.pgvector.yml up -d
  ) >> "$LOG_DIR/pgvector.log" 2>&1
}

ensure_build() {
  if [ -f "$ROOT_DIR/.next/BUILD_ID" ] && [ "${DDSTUDY_FORCE_BUILD:-0}" != "1" ]; then
    return
  fi
  log "building Next.js production bundle"
  (
    cd "$ROOT_DIR" || exit 1
    DATABASE_URL="$DATABASE_URL" RAG_VECTOR_BACKEND="$RAG_VECTOR_BACKEND" pnpm build
  ) >> "$LOG_DIR/build.log" 2>&1
}

start_app() {
  if local_health_ready; then
    return
  fi

  if port_ready "$APP_PORT"; then
    log "port :$APP_PORT is occupied but app health is not ready; restarting ddstudy-app screen only"
  fi

  screen -S ddstudy-app -X quit >/dev/null 2>&1 || true
  ensure_build
  log "starting ddstudy app on :$APP_PORT"
  screen -S ddstudy-app -dm zsh -lc "
    cd '$ROOT_DIR' || exit 1
    export DATABASE_URL='$DATABASE_URL'
    export RAG_VECTOR_BACKEND='$RAG_VECTOR_BACKEND'
    while true; do
      pnpm start --hostname 0.0.0.0 --port '$APP_PORT' >> '$LOG_DIR/app.log' 2>&1
      sleep 2
    done
  "
}

start_tunnel() {
  if tunnel_ready; then
    return
  fi
  if [ ! -x "$CLOUDFLARED_BIN" ]; then
    log "cloudflared not executable at $CLOUDFLARED_BIN"
    return
  fi
  if [ ! -f "$CLOUDFLARED_TOKEN_FILE" ]; then
    log "cloudflared token file missing at $CLOUDFLARED_TOKEN_FILE"
    return
  fi
  log "starting Cloudflare tunnel for $PUBLIC_HOSTNAME"
  screen -S ddstudy-tunnel -dm zsh -lc "
    '$CLOUDFLARED_BIN' tunnel --no-autoupdate --loglevel info run --token-file '$CLOUDFLARED_TOKEN_FILE' >> '$LOG_DIR/cloudflared.log' 2>&1
  "
}

log "Ddstudy local demo supervisor started"
log "public hostname: https://$PUBLIC_HOSTNAME"

while true; do
  if network_ready; then
    start_pgvector
    start_app
    start_tunnel
    if local_health_ready; then
      log "local health ready on :$APP_PORT"
    else
      log "local health is not ready yet"
    fi
    if public_health_ready; then
      log "public health ready at https://$PUBLIC_HOSTNAME/api/health"
    else
      log "public health is not ready yet"
    fi
  else
    log "network is not ready; waiting"
  fi
  sleep "$CHECK_INTERVAL_SEC"
done
