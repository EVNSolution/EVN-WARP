#!/usr/bin/env bash
set -euo pipefail

ACTION="${DEPLOY_ACTION:-validate}"
SERVER_NAME="${SERVER_NAME:-warp.cleversystem.ai}"
RUNTIME_DIR="${RUNTIME_DIR:-/opt/evn-warp-runtime}"
LEGACY_APP_DIR="${LEGACY_APP_DIR:-/opt/evn-warp}"
UPLOADS_DIR="${UPLOADS_DIR:-/opt/evn-uploads}"
DATA_DIR="${DATA_DIR:-$LEGACY_APP_DIR/data}"
SSM_APP_ENV_PARAM="${SSM_APP_ENV_PARAM:-/evn-warp/app-env}"
UPSTREAM_CONF="${UPSTREAM_CONF:-/etc/nginx/conf.d/warp-active-upstream.conf}"
IMAGE_REF="${IMAGE_REF:-}"
SOURCE_REVISION="${SOURCE_REVISION:-}"
RELEASE_ID="${RELEASE_ID:-}"
ACTOR="${ACTOR:-OziinG}"
VALIDATOR="${VALIDATOR:-/tmp/evn-validate-env.py}"
EVIDENCE_FILE="$RUNTIME_DIR/deploy-evidence.jsonl"
APP_ENV_FILE="$RUNTIME_DIR/app.env"

slot_port() {
  case "$1" in
    legacy) echo 3000 ;;
    blue) echo 3101 ;;
    green) echo 3102 ;;
    *) echo "Invalid slot: $1" >&2; return 2 ;;
  esac
}

container_name() {
  case "$1" in
    blue|green) echo "evn-warp-$1" ;;
    *) echo "No container for slot: $1" >&2; return 2 ;;
  esac
}

cleanup_file() {
  local target="$1"
  [ ! -e "$target" ] || shred -u "$target" 2>/dev/null || rm -f "$target"
}

append_evidence() {
  python3 - "$EVIDENCE_FILE" "$ACTOR" "$@" <<'PY'
import datetime, json, os, sys
path, actor, *pairs = sys.argv[1:]
event = dict(pair.split('=', 1) for pair in pairs)
event['actor'] = actor
event['timestamp'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'a', encoding='utf-8') as target:
    target.write(json.dumps(event, ensure_ascii=False) + '\n')
PY
}

write_manifest() {
  local slot="$1" digest="$2" ssm_version="$3"
  local target="$RUNTIME_DIR/manifests/$slot.json"
  python3 - "$target" "$slot" "$RELEASE_ID" "$SOURCE_REVISION" "$IMAGE_REF" "$digest" "$ssm_version" <<'PY'
import datetime, json, os, sys, tempfile
target, slot, release, revision, image_ref, digest, ssm_version = sys.argv[1:]
data = {
    'slot': slot,
    'release': release,
    'revision': revision,
    'imageRef': image_ref,
    'imageDigest': digest,
    'ssmParameterVersion': int(ssm_version),
    'preparedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
os.makedirs(os.path.dirname(target), exist_ok=True)
fd, temporary = tempfile.mkstemp(dir=os.path.dirname(target), prefix='.manifest-', text=True)
with os.fdopen(fd, 'w', encoding='utf-8') as output:
    json.dump(data, output, ensure_ascii=False, indent=2)
    output.write('\n')
os.replace(temporary, target)
PY
}

manifest_field() {
  python3 - "$RUNTIME_DIR/manifests/$1.json" "$2" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as source:
    print(json.load(source)[sys.argv[2]])
PY
}

fetch_and_validate_env() {
  local install_runtime="$1" payload env_candidate
  payload="$(mktemp)"
  env_candidate="$(mktemp)"
  chmod 600 "$payload" "$env_candidate"

  if ! aws ssm get-parameter --name "$SSM_APP_ENV_PARAM" --with-decryption --output json >"$payload"; then
    cleanup_file "$payload"
    cleanup_file "$env_candidate"
    echo "Unable to read SSM SecureString: $SSM_APP_ENV_PARAM" >&2
    return 1
  fi
  SSM_VERSION="$(python3 - "$payload" "$env_candidate" <<'PY'
import json, os, sys
payload, target = sys.argv[1:]
with open(payload, encoding='utf-8') as source:
    parameter = json.load(source)['Parameter']
with open(target, 'w', encoding='utf-8') as output:
    output.write(parameter['Value'].rstrip('\n') + '\n')
os.chmod(target, 0o600)
print(parameter['Version'])
PY
)"
  if ! "$VALIDATOR" "$env_candidate"; then
    cleanup_file "$payload"
    cleanup_file "$env_candidate"
    return 1
  fi

  if [ -f "$LEGACY_APP_DIR/.env" ]; then
    python3 - "$LEGACY_APP_DIR/.env" "$env_candidate" <<'PY'
from pathlib import Path
import sys
left, right = (Path(path).read_text(encoding='utf-8').rstrip('\n') for path in sys.argv[1:])
print('legacy_env_matches_ssm=' + str(left == right).lower())
PY
  fi
  if [ "$install_runtime" = 1 ]; then
    install -m 0600 "$env_candidate" "$APP_ENV_FILE.candidate"
    mv "$APP_ENV_FILE.candidate" "$APP_ENV_FILE"
  fi
  cleanup_file "$payload"
  cleanup_file "$env_candidate"
  export SSM_VERSION
}

wait_ready() {
  local slot="$1" expected="$2" port
  port="$(slot_port "$slot")"
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 3 "http://127.0.0.1:${port}/api/readyz" 2>/dev/null |
      python3 -c 'import json,sys; body=json.load(sys.stdin); expected=sys.argv[1]; raise SystemExit(0 if body.get("ok") is True and body.get("imageDigest")==expected else 1)' "$expected"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

external_ready() {
  local slot="$1"
  if [ "$slot" = legacy ]; then
    curl -fsS --max-time 10 "https://${SERVER_NAME}/login" >/dev/null
    return
  fi
  local expected
  expected="$(manifest_field "$slot" imageDigest)"
  curl -fsS --max-time 10 -H 'X-Warp-External-Check: 1' "https://${SERVER_NAME}/api/readyz" |
    python3 -c 'import json,sys; body=json.load(sys.stdin); expected=sys.argv[1]; raise SystemExit(0 if body.get("ok") is True and body.get("imageDigest")==expected else 1)' "$expected"
}

render_upstream() {
  local slot="$1" target="$2" port
  port="$(slot_port "$slot")"
  cat >"$target" <<EOF_UPSTREAM
upstream warp_active {
    server 127.0.0.1:${port};
    keepalive 32;
}
EOF_UPSTREAM
}

activate_slot() {
  local target="$1" current backup candidate
  current="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || echo legacy)"
  [ "$target" != "$current" ] || { echo "Slot already active: $target"; return 0; }
  if [ "$target" != legacy ]; then
    test -f "$RUNTIME_DIR/manifests/$target.json"
    wait_ready "$target" "$(manifest_field "$target" imageDigest)"
  fi

  backup="$RUNTIME_DIR/upstream.previous"
  candidate="$RUNTIME_DIR/upstream.candidate"
  cp "$UPSTREAM_CONF" "$backup"
  render_upstream "$target" "$candidate"
  cp "$candidate" "$UPSTREAM_CONF"
  if ! nginx -t || ! systemctl reload nginx || ! external_ready "$target"; then
    cp "$backup" "$UPSTREAM_CONF"
    nginx -t
    systemctl reload nginx
    if ! external_ready "$current"; then
      append_evidence "event=rollback-failed" "candidate=$target" "restored=$current"
      echo 'Candidate verification and automatic rollback verification both failed.' >&2
      return 2
    fi
    append_evidence "event=switch-rolled-back" "candidate=$target" "restored=$current"
    echo "Candidate verification failed; restored $current." >&2
    return 1
  fi

  printf '%s\n' "$current" >"$RUNTIME_DIR/previous-slot"
  printf '%s\n' "$target" >"$RUNTIME_DIR/active-slot"
  rm -f "$RUNTIME_DIR/candidate-slot"
  append_evidence "event=switch-succeeded" "previous=$current" "active=$target"
  echo "Active slot: $target (previous: $current)"
}

prepare() {
  [[ "$IMAGE_REF" =~ ^.+@sha256:[0-9a-f]{64}$ ]] || { echo 'IMAGE_REF must be an immutable repository digest.' >&2; exit 2; }
  [[ "$SOURCE_REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'SOURCE_REVISION must be a full Git SHA.' >&2; exit 2; }
  [ -n "$RELEASE_ID" ]
  /tmp/evn-setup.sh
  fetch_and_validate_env 1

  local active slot port name digest registry
  active="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || echo legacy)"
  if [ "$active" = blue ]; then slot=green; else slot=blue; fi
  port="$(slot_port "$slot")"
  name="$(container_name "$slot")"
  digest="${IMAGE_REF##*@}"
  registry="${IMAGE_REF%%/*}"

  test -f "$LEGACY_APP_DIR/dev.db"
  install -d -m 2770 -o root -g 1001 "$UPLOADS_DIR" "$DATA_DIR" "$RUNTIME_DIR/cache/$slot"
  chgrp -R 1001 "$UPLOADS_DIR" "$DATA_DIR"
  chmod -R g+rwX "$UPLOADS_DIR" "$DATA_DIR"
  find "$UPLOADS_DIR" "$DATA_DIR" -type d -exec chmod g+s {} +
  cp --reflink=auto "$RUNTIME_DIR/database/dev.db" "$RUNTIME_DIR/backups/dev-$(date +%Y%m%d-%H%M%S)-pre-${RELEASE_ID}.db"

  aws ecr get-login-password | docker login --username AWS --password-stdin "$registry" >/dev/null
  if ! docker pull "$IMAGE_REF" >/dev/null; then
    docker logout "$registry" >/dev/null 2>&1 || true
    return 1
  fi
  docker logout "$registry" >/dev/null 2>&1 || true
  docker container inspect "$name" >/dev/null 2>&1 && docker rm -f "$name" >/dev/null
  docker run -d \
    --name "$name" \
    --restart unless-stopped \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --pids-limit 256 \
    --memory 384m \
    --memory-swap 768m \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    -p "127.0.0.1:${port}:3000" \
    --env-file "$APP_ENV_FILE" \
    -e "AUTH_URL=https://${SERVER_NAME}" \
    -e "NEXTAUTH_URL=https://${SERVER_NAME}" \
    -e 'AUTH_TRUST_HOST=true' \
    -e 'DATABASE_URL=file:/app/database/dev.db' \
    -e 'UPLOADS_DIR=/app/uploads' \
    -e 'DATA_DIR=/app/data' \
    -e 'NODE_OPTIONS=--max-old-space-size=256' \
    -e "WARP_SLOT=$slot" \
    -e "WARP_RELEASE_ID=$RELEASE_ID" \
    -e "WARP_SOURCE_REVISION=$SOURCE_REVISION" \
    -e "WARP_IMAGE_DIGEST=$digest" \
    -v "$RUNTIME_DIR/database:/app/database" \
    -v "$UPLOADS_DIR:/app/uploads" \
    -v "$UPLOADS_DIR:/app/public/uploads" \
    -v "$DATA_DIR:/app/data" \
    -v "$RUNTIME_DIR/cache/$slot:/app/.next/cache" \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    "$IMAGE_REF" >/dev/null

  if ! wait_ready "$slot" "$digest"; then
    docker logs --tail 80 "$name" >&2 || true
    append_evidence "event=prepare-blocked" "slot=$slot" "release=$RELEASE_ID" "digest=$digest" "ssmVersion=$SSM_VERSION"
    echo "Candidate did not become ready: $slot" >&2
    return 1
  fi
  write_manifest "$slot" "$digest" "$SSM_VERSION"
  printf '%s\n' "$slot" >"$RUNTIME_DIR/candidate-slot"
  append_evidence "event=prepared" "slot=$slot" "release=$RELEASE_ID" "revision=$SOURCE_REVISION" "digest=$digest" "ssmVersion=$SSM_VERSION"
  echo "Prepared $slot release=$RELEASE_ID digest=$digest ssmVersion=$SSM_VERSION; traffic unchanged on $active."
}

status() {
  local active previous candidate
  active="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || echo legacy)"
  previous="$(cat "$RUNTIME_DIR/previous-slot" 2>/dev/null || echo none)"
  candidate="$(cat "$RUNTIME_DIR/candidate-slot" 2>/dev/null || echo none)"
  echo "active=$active previous=$previous candidate=$candidate"
  if ! command -v docker >/dev/null 2>&1; then
    echo 'docker=absent'
    return
  fi
  for slot in blue green; do
    local name state image
    name="$(container_name "$slot")"
    if docker container inspect "$name" >/dev/null 2>&1; then
      state="$(docker inspect -f '{{.State.Status}}' "$name")"
      image="$(docker inspect -f '{{.Config.Image}}' "$name")"
      echo "$slot state=$state image=$image"
    else
      echo "$slot state=absent"
    fi
  done
}

case "$ACTION" in
  validate)
    fetch_and_validate_env 0
    echo "Validation only completed for SSM version $SSM_VERSION; runtime and traffic were not changed."
    ;;
  prepare) prepare ;;
  switch)
    target="$(cat "$RUNTIME_DIR/candidate-slot" 2>/dev/null || true)"
    [ -n "$target" ] || { echo 'No prepared candidate slot.' >&2; exit 1; }
    [ "$(manifest_field "$target" revision)" = "$SOURCE_REVISION" ] || {
      echo 'Prepared candidate does not match the current main revision.' >&2
      exit 1
    }
    activate_slot "$target"
    ;;
  rollback)
    target="$(cat "$RUNTIME_DIR/previous-slot" 2>/dev/null || true)"
    [ -n "$target" ] || { echo 'No previous slot is recorded.' >&2; exit 1; }
    activate_slot "$target"
    ;;
  status) status ;;
  *) echo "Unsupported DEPLOY_ACTION: $ACTION" >&2; exit 2 ;;
esac
