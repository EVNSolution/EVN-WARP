#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$LAB_DIR/../.." && pwd)"
RUNTIME_DIR="${WARP_LAB_RUNTIME_DIR:-$LAB_DIR/runtime}"
SHARED_DIR="$RUNTIME_DIR/shared"
IMAGE_DIR="$RUNTIME_DIR/images"
SLOT_DIR="$RUNTIME_DIR/slots"
NGINX_DIR="$RUNTIME_DIR/nginx"
NETWORK="warp-bg-lab"
REGISTRY="warp-bg-lab-registry"
PROXY="warp-bg-lab-proxy"
REGISTRY_IMAGE="registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373"
PROXY_IMAGE="nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10"
REGISTRY_PORT="${WARP_LAB_REGISTRY_PORT:-5001}"
PROXY_PORT="${WARP_LAB_PROXY_PORT:-3300}"
START_REGISTRY="${WARP_LAB_START_REGISTRY:-1}"
IMAGE_REPOSITORY="${WARP_LAB_IMAGE_REPOSITORY:-127.0.0.1:${REGISTRY_PORT}/warp}"

usage() {
  cat <<'EOF'
Usage: labctl.sh <command> [args]
  init
  build <release-id>
  register-image <release-id> <repository@sha256:digest> <source-revision>
  prepare <blue|green> <release-id> [none|readiness|external]
  switch <blue|green>
  rollback
  restart-active
  status
  reset-slots
  destroy
EOF
}

require_command() {
  command -v "$1" >/dev/null || { echo "Missing command: $1" >&2; exit 1; }
}

slot_port() {
  case "$1" in
    blue) echo 3101 ;;
    green) echo 3102 ;;
    *) echo "Invalid slot: $1" >&2; exit 2 ;;
  esac
}

container_name() {
  echo "warp-bg-lab-$1"
}

json_field() {
  python3 - "$1" "$2" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    print(json.load(f)[sys.argv[2]])
PY
}

write_json() {
  local target="$1"
  shift
  python3 - "$target" "$@" <<'PY'
import json, os, sys, tempfile
target = sys.argv[1]
values = dict(arg.split('=', 1) for arg in sys.argv[2:])
os.makedirs(os.path.dirname(target), exist_ok=True)
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(target), prefix='.manifest-', text=True)
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    json.dump(values, f, ensure_ascii=False, indent=2)
    f.write('\n')
os.replace(tmp, target)
PY
}

append_evidence() {
  python3 - "$RUNTIME_DIR/evidence.jsonl" "$@" <<'PY'
import datetime, json, os, sys
event = dict(arg.split('=', 1) for arg in sys.argv[2:])
event['timestamp'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
os.makedirs(os.path.dirname(sys.argv[1]), exist_ok=True)
with open(sys.argv[1], 'a', encoding='utf-8') as f:
    f.write(json.dumps(event, ensure_ascii=False) + '\n')
PY
}

ensure_runtime() {
  require_command docker
  require_command curl
  require_command python3
  mkdir -p "$SHARED_DIR/uploads" "$SHARED_DIR/public-uploads" "$SHARED_DIR/data" "$IMAGE_DIR" "$SLOT_DIR" "$NGINX_DIR"
  chmod 0777 "$SHARED_DIR/uploads" "$SHARED_DIR/public-uploads" "$SHARED_DIR/data"

  if [ ! -f "$RUNTIME_DIR/app.env" ]; then
    umask 077
    {
      echo "AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')"
      echo 'AUTH_TRUST_HOST=true'
      echo "AUTH_URL=http://127.0.0.1:${PROXY_PORT}"
      echo "NEXTAUTH_URL=http://127.0.0.1:${PROXY_PORT}"
    } > "$RUNTIME_DIR/app.env"
  fi
  if [ ! -f "$RUNTIME_DIR/next-actions.key" ]; then
    umask 077
    openssl rand -base64 32 | tr -d '\n' > "$RUNTIME_DIR/next-actions.key"
  fi

  if [ ! -f "$SHARED_DIR/dev.db" ]; then
    [ "$START_REGISTRY" = 1 ] || {
      echo 'Remote lab requires a prebuilt, non-production seed database.' >&2
      exit 1
    }
    : > "$SHARED_DIR/dev.db"
    chmod 0666 "$SHARED_DIR/dev.db"
    (cd "$REPO_DIR" && DATABASE_URL="file:$SHARED_DIR/dev.db" npx prisma generate >/dev/null && DATABASE_URL="file:$SHARED_DIR/dev.db" npx prisma db push >/dev/null)
  fi

  for source in "$REPO_DIR"/data/*.json; do
    [ -f "$source" ] || continue
    target="$SHARED_DIR/data/$(basename "$source")"
    [ -f "$target" ] || cp "$source" "$target"
  done

  docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
  if [ "$START_REGISTRY" = 1 ]; then
    if ! docker container inspect "$REGISTRY" >/dev/null 2>&1; then
      docker run -d --name "$REGISTRY" --restart unless-stopped --network "$NETWORK" -p "127.0.0.1:${REGISTRY_PORT}:5000" "$REGISTRY_IMAGE" >/dev/null
    elif [ "$(docker inspect -f '{{.State.Running}}' "$REGISTRY")" != true ]; then
      docker start "$REGISTRY" >/dev/null
    fi
  fi
}

build_image() {
  local release="${1:-}"
  [[ "$release" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Release id must contain only letters, numbers, dot, underscore or dash.' >&2; exit 2; }
  ensure_runtime
  local revision ref repo_digest digest
  revision="$(git -C "$REPO_DIR" rev-parse HEAD)"
  ref="$IMAGE_REPOSITORY:$release"
  docker build \
    --quiet \
    --secret "id=next_actions_key,src=$RUNTIME_DIR/next-actions.key" \
    --build-arg "WARP_RELEASE_ID=$release" \
    --build-arg "WARP_SOURCE_REVISION=$revision" \
    --tag "$ref" "$REPO_DIR"
  docker push "$ref" >/dev/null
  repo_digest="$(docker image inspect "$ref" --format '{{index .RepoDigests 0}}')"
  digest="${repo_digest##*@}"
  write_json "$IMAGE_DIR/$release.json" \
    "release=$release" "revision=$revision" "imageRef=$ref" "repoDigest=$repo_digest" "digest=$digest"
  append_evidence "event=image-built" "release=$release" "revision=$revision" "imageDigest=$digest"
  echo "$repo_digest"
}

register_image() {
  local release="${1:-}" repo_digest="${2:-}" revision="${3:-}" digest
  [[ "$release" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Invalid release id.' >&2; exit 2; }
  [[ "$repo_digest" =~ ^.+@sha256:[0-9a-f]{64}$ ]] || { echo 'Image must be registered by repository digest.' >&2; exit 2; }
  [ -n "$revision" ] || { echo 'Source revision is required.' >&2; exit 2; }
  ensure_runtime
  digest="${repo_digest##*@}"
  write_json "$IMAGE_DIR/$release.json" \
    "release=$release" "revision=$revision" "imageRef=${repo_digest%@*}:$release" "repoDigest=$repo_digest" "digest=$digest"
  append_evidence "event=image-registered" "release=$release" "revision=$revision" "imageDigest=$digest"
  echo "Registered $release ($digest)"
}

wait_ready() {
  local port="$1"
  for _ in $(seq 1 30); do
    if curl -fs --max-time 2 "http://127.0.0.1:${port}/api/readyz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

prepare_slot() {
  local slot="${1:-}" release="${2:-}" fault="${3:-none}"
  local port active manifest repo_digest digest revision name
  port="$(slot_port "$slot")"
  case "$fault" in none|readiness|external) ;; *) echo "Invalid fault: $fault" >&2; exit 2 ;; esac
  ensure_runtime
  active="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || true)"
  [ "$slot" != "$active" ] || { echo "Refusing to replace active slot: $slot" >&2; exit 1; }
  manifest="$IMAGE_DIR/$release.json"
  [ -f "$manifest" ] || { echo "Unknown release: $release" >&2; exit 1; }
  repo_digest="$(json_field "$manifest" repoDigest)"
  digest="$(json_field "$manifest" digest)"
  revision="$(json_field "$manifest" revision)"
  name="$(container_name "$slot")"
  docker pull "$repo_digest" >/dev/null
  docker container inspect "$name" >/dev/null 2>&1 && docker rm -f "$name" >/dev/null
  docker run -d \
    --name "$name" \
    --restart unless-stopped \
    --network "$NETWORK" \
    -p "127.0.0.1:${port}:3000" \
    --env-file "$RUNTIME_DIR/app.env" \
    -e "AUTH_URL=http://127.0.0.1:${PROXY_PORT}" \
    -e "NEXTAUTH_URL=http://127.0.0.1:${PROXY_PORT}" \
    -e "DATABASE_URL=file:/app/dev.db" \
    -e 'UPLOADS_DIR=/app/uploads' \
    -e 'DATA_DIR=/app/data' \
    -e 'WARP_DEPLOYMENT_LAB=1' \
    -e "WARP_LAB_FAULT=$fault" \
    -e "WARP_SLOT=$slot" \
    -e "WARP_RELEASE_ID=$release" \
    -e "WARP_SOURCE_REVISION=$revision" \
    -e "WARP_IMAGE_DIGEST=$digest" \
    -v "$SHARED_DIR/dev.db:/app/dev.db" \
    -v "$SHARED_DIR/uploads:/app/uploads" \
    -v "$SHARED_DIR/public-uploads:/app/public/uploads" \
    -v "$SHARED_DIR/data:/app/data" \
    "$repo_digest" >/dev/null

  if ! wait_ready "$port"; then
    append_evidence "event=prepare-blocked" "slot=$slot" "release=$release" "imageDigest=$digest" "fault=$fault"
    echo "Candidate did not become ready: $slot/$release" >&2
    return 1
  fi
  write_json "$SLOT_DIR/$slot.json" \
    "slot=$slot" "release=$release" "revision=$revision" "imageDigest=$digest" "repoDigest=$repo_digest"
  append_evidence "event=prepared" "slot=$slot" "release=$release" "imageDigest=$digest" "fault=$fault"
  echo "Prepared $slot with $release ($digest)"
}

render_upstream() {
  local slot="$1" target="$NGINX_DIR/active-upstream.conf.new"
  cat > "$target" <<EOF
upstream warp_active {
  server $(container_name "$slot"):3000;
  keepalive 32;
}
EOF
}

reload_proxy() {
  docker exec "$PROXY" nginx -t >/dev/null
  docker exec "$PROXY" nginx -s reload
}

proxy_digest() {
  curl -fsS --max-time 2 "http://127.0.0.1:${PROXY_PORT}/api/healthz" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["imageDigest"])'
}

wait_proxy_digest() {
  local expected="$1" actual
  for _ in $(seq 1 20); do
    if actual="$(proxy_digest 2>/dev/null)" && [ "$actual" = "$expected" ]; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

start_proxy() {
  if docker container inspect "$PROXY" >/dev/null 2>&1 && [ "$(docker inspect -f '{{.State.Running}}' "$PROXY")" != true ]; then
    docker rm -f "$PROXY" >/dev/null
  fi
  if ! docker container inspect "$PROXY" >/dev/null 2>&1; then
    docker run -d \
      --name "$PROXY" \
      --restart unless-stopped \
      --network "$NETWORK" \
      -p "127.0.0.1:${PROXY_PORT}:8080" \
      -v "$LAB_DIR/nginx.conf:/etc/nginx/nginx.conf:ro" \
      -v "$NGINX_DIR:/etc/nginx/conf.d:ro" \
      "$PROXY_IMAGE" >/dev/null
    for _ in $(seq 1 10); do
      docker exec "$PROXY" nginx -t >/dev/null 2>&1 && return 0
      sleep 1
    done
    echo 'Proxy did not become ready.' >&2
    return 1
  fi
}

switch_slot() {
  local slot="${1:-}" port manifest release digest previous previous_digest backup
  port="$(slot_port "$slot")"
  manifest="$SLOT_DIR/$slot.json"
  [ -f "$manifest" ] || { echo "Slot is not prepared: $slot" >&2; exit 1; }
  wait_ready "$port" || { echo "Candidate is not ready: $slot" >&2; exit 1; }
  release="$(json_field "$manifest" release)"
  digest="$(json_field "$manifest" imageDigest)"
  previous="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || true)"
  previous_digest=''
  if [ -n "$previous" ] && [ -f "$SLOT_DIR/$previous.json" ]; then
    previous_digest="$(json_field "$SLOT_DIR/$previous.json" imageDigest)"
  fi
  backup="$NGINX_DIR/active-upstream.conf.previous"
  [ ! -f "$NGINX_DIR/active-upstream.conf" ] || cp "$NGINX_DIR/active-upstream.conf" "$backup"
  render_upstream "$slot"
  mv "$NGINX_DIR/active-upstream.conf.new" "$NGINX_DIR/active-upstream.conf"
  start_proxy
  if ! reload_proxy || ! wait_proxy_digest "$digest" || ! curl -fs --max-time 5 -H 'X-Warp-External-Check: 1' "http://127.0.0.1:${PROXY_PORT}/api/readyz" >/dev/null 2>&1; then
    if [ -n "$previous" ] && [ -f "$backup" ]; then
      mv "$backup" "$NGINX_DIR/active-upstream.conf"
      if ! reload_proxy || ! wait_proxy_digest "$previous_digest" || ! curl -fs --max-time 5 "http://127.0.0.1:${PROXY_PORT}/api/readyz" >/dev/null 2>&1; then
        append_evidence "event=rollback-failed" "candidateSlot=$slot" "candidateRelease=$release" "candidateDigest=$digest" "restoredSlot=$previous"
        echo "External verification and rollback verification failed." >&2
        return 2
      fi
    else
      docker rm -f "$PROXY" >/dev/null 2>&1 || true
    fi
    append_evidence "event=switch-rolled-back" "candidateSlot=$slot" "candidateRelease=$release" "candidateDigest=$digest" "restoredSlot=${previous:-none}"
    echo "External verification failed; restored ${previous:-no active slot}." >&2
    return 1
  fi
  [ -z "$previous" ] || printf '%s\n' "$previous" > "$RUNTIME_DIR/previous-slot"
  printf '%s\n' "$slot" > "$RUNTIME_DIR/active-slot"
  append_evidence "event=switch-succeeded" "previousSlot=${previous:-none}" "activeSlot=$slot" "release=$release" "imageDigest=$digest"
  echo "Active slot: $slot ($release, $digest)"
}

rollback_slot() {
  local previous
  previous="$(cat "$RUNTIME_DIR/previous-slot" 2>/dev/null || true)"
  [ -n "$previous" ] || { echo 'No previous slot is recorded.' >&2; exit 1; }
  switch_slot "$previous"
}

restart_active() {
  local active port manifest expected actual
  active="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || true)"
  [ -n "$active" ] || { echo 'No active slot is recorded.' >&2; exit 1; }
  port="$(slot_port "$active")"
  manifest="$SLOT_DIR/$active.json"
  expected="$(json_field "$manifest" imageDigest)"
  docker restart "$(container_name "$active")" >/dev/null
  wait_ready "$port"
  actual="$(curl -fsS "http://127.0.0.1:${PROXY_PORT}/api/healthz" | python3 -c 'import json,sys; print(json.load(sys.stdin)["imageDigest"])')"
  [ "$actual" = "$expected" ] || { echo "Digest mismatch after restart: $actual != $expected" >&2; exit 1; }
  append_evidence "event=restart-verified" "activeSlot=$active" "imageDigest=$actual"
  echo "Restart preserved $active/$actual"
}

status() {
  local active previous
  active="$(cat "$RUNTIME_DIR/active-slot" 2>/dev/null || echo none)"
  previous="$(cat "$RUNTIME_DIR/previous-slot" 2>/dev/null || echo none)"
  echo "active=$active previous=$previous"
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

reset_slots() {
  local name target
  for name in "$(container_name blue)" "$(container_name green)" "$PROXY"; do
    docker container inspect "$name" >/dev/null 2>&1 && docker rm -f "$name" >/dev/null
  done
  for target in \
    "$RUNTIME_DIR/active-slot" \
    "$RUNTIME_DIR/previous-slot" \
    "$SLOT_DIR/blue.json" \
    "$SLOT_DIR/green.json" \
    "$NGINX_DIR/active-upstream.conf" \
    "$NGINX_DIR/active-upstream.conf.previous"; do
    [ ! -e "$target" ] || unlink "$target"
  done
  append_evidence "event=slots-reset"
  echo 'Removed lab slots and routing state. Images, shared data and evidence remain.'
}

destroy_lab() {
  reset_slots
  if [ "$START_REGISTRY" = 1 ]; then
    docker container inspect "$REGISTRY" >/dev/null 2>&1 && docker rm -f "$REGISTRY" >/dev/null
  fi
  docker network inspect "$NETWORK" >/dev/null 2>&1 && docker network rm "$NETWORK" >/dev/null
  echo "Removed lab containers and network. Evidence remains in $RUNTIME_DIR"
}

command="${1:-}"
shift || true
case "$command" in
  init) ensure_runtime ;;
  build) build_image "$@" ;;
  register-image) register_image "$@" ;;
  prepare) prepare_slot "$@" ;;
  switch) switch_slot "$@" ;;
  rollback) rollback_slot ;;
  restart-active) restart_active ;;
  status) status ;;
  reset-slots) reset_slots ;;
  destroy) destroy_lab ;;
  *) usage; exit 2 ;;
esac
