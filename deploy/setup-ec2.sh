#!/usr/bin/env bash
set -Eeuo pipefail

SERVER_NAME="${SERVER_NAME:-warp.cleversystem.ai}"
LEGACY_PORT="${LEGACY_PORT:-3000}"
RUNTIME_DIR="${RUNTIME_DIR:-/opt/evn-warp-runtime}"
LEGACY_APP_DIR="${LEGACY_APP_DIR:-/opt/evn-warp}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/${SERVER_NAME}.conf}"
UPSTREAM_CONF="${UPSTREAM_CONF:-/etc/nginx/conf.d/warp-active-upstream.conf}"
SETUP_MARKER="$RUNTIME_DIR/.container-blue-green-ready"
DATABASE_DIR="$RUNTIME_DIR/database"
DATABASE_TARGET="$DATABASE_DIR/dev.db"
LEGACY_DATABASE="$LEGACY_APP_DIR/dev.db"
PM2_STOPPED=0

need() { command -v "$1" >/dev/null 2>&1; }

restore_legacy_process() {
  if [ "$PM2_STOPPED" = 1 ]; then
    set +e
    pm2 restart evn-warp --update-env >/dev/null 2>&1
  fi
}

wait_legacy_ready() {
  for _ in $(seq 1 60); do
    curl -fsS --max-time 2 "http://127.0.0.1:${LEGACY_PORT}/login" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "Legacy WARP did not become ready on port ${LEGACY_PORT}." >&2
  return 1
}

trap restore_legacy_process ERR

if ! need apt-get; then
  echo 'Unsupported package manager; WARP production uses Ubuntu.' >&2
  exit 1
fi

install -d -m 0750 "$RUNTIME_DIR" "$RUNTIME_DIR/manifests" "$RUNTIME_DIR/cache/blue" "$RUNTIME_DIR/cache/green" "$RUNTIME_DIR/backups"
install -d -m 2770 -o root -g 1001 "$DATABASE_DIR"

if ! need docker; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends docker.io
fi
systemctl enable --now docker >/dev/null
systemctl is-active --quiet nginx
test -f "$NGINX_CONF"
test -f "$LEGACY_DATABASE"

if [ ! -L "$LEGACY_DATABASE" ]; then
  test ! -e "$DATABASE_TARGET"
  if command -v pm2 >/dev/null 2>&1 && [ "$(pm2 pid evn-warp 2>/dev/null || echo 0)" != 0 ]; then
    pm2 stop evn-warp >/dev/null
    PM2_STOPPED=1
    for _ in $(seq 1 25); do
      [ "$(pm2 pid evn-warp 2>/dev/null || echo 0)" = 0 ] && break
      sleep 0.2
    done
    [ "$(pm2 pid evn-warp 2>/dev/null || echo 0)" = 0 ]
  fi
  cp --reflink=auto "$LEGACY_DATABASE" "$RUNTIME_DIR/backups/dev-$(date +%Y%m%d-%H%M%S)-pre-shared-path.db"
  /tmp/evn-migrate-shared-db.py "$LEGACY_DATABASE" "$DATABASE_TARGET"
  chgrp 1001 "$DATABASE_TARGET"
  chmod 0660 "$DATABASE_TARGET"
  if [ "$PM2_STOPPED" = 1 ]; then
    pm2 restart evn-warp --update-env >/dev/null
    wait_legacy_ready
    PM2_STOPPED=0
  fi
else
  test "$(readlink -f "$LEGACY_DATABASE")" = "$DATABASE_TARGET"
fi
chgrp 1001 "$DATABASE_TARGET"
chmod 0660 "$DATABASE_TARGET"

if [ ! -f "$UPSTREAM_CONF" ]; then
  cat >"$UPSTREAM_CONF" <<EOF_UPSTREAM
upstream warp_active {
    server 127.0.0.1:${LEGACY_PORT};
    keepalive 32;
}
EOF_UPSTREAM
fi

if grep -qE 'proxy_pass[[:space:]]+http://127\.0\.0\.1:[0-9]+;' "$NGINX_CONF"; then
  candidate="$(mktemp)"
  trap 'rm -f "$candidate"' EXIT
  sed -E 's#proxy_pass[[:space:]]+http://127\.0\.0\.1:[0-9]+;#proxy_pass http://warp_active;#' "$NGINX_CONF" >"$candidate"
  [ -f "$RUNTIME_DIR/legacy-nginx.conf" ] || cp "$NGINX_CONF" "$RUNTIME_DIR/legacy-nginx.conf"
  cp "$candidate" "$NGINX_CONF"
  if ! nginx -t; then
    cp "$RUNTIME_DIR/legacy-nginx.conf" "$NGINX_CONF"
    nginx -t
    echo 'Nginx upstream bootstrap failed; restored legacy config.' >&2
    exit 1
  fi
  systemctl reload nginx
elif ! grep -q 'proxy_pass http://warp_active;' "$NGINX_CONF"; then
  echo "Unexpected Nginx proxy contract: $NGINX_CONF" >&2
  exit 1
fi

nginx -t
wait_legacy_ready
[ -f "$RUNTIME_DIR/active-slot" ] || printf 'legacy\n' >"$RUNTIME_DIR/active-slot"
touch "$SETUP_MARKER"
trap - ERR
echo 'WARP container Blue/Green bootstrap is ready; traffic remains on the recorded active slot.'
