#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABCTL="$LAB_DIR/labctl.sh"
RUNTIME_DIR="${WARP_LAB_RUNTIME_DIR:-$LAB_DIR/runtime}"
PROXY_PORT="${WARP_LAB_PROXY_PORT:-3300}"
PROBE_PID=''

for release in lab-a lab-b lab-c lab-d lab-e; do
  [ -f "$RUNTIME_DIR/images/$release.json" ] || {
    echo "Missing image manifest: $release" >&2
    exit 1
  }
done

assert_identity() {
  local release="$1"
  local manifest="$RUNTIME_DIR/images/$release.json"
  curl -fsS "http://127.0.0.1:${PROXY_PORT}/api/healthz" |
    python3 -c '
import json, sys
manifest_path, expected_release = sys.argv[1:]
with open(manifest_path, encoding="utf-8") as source:
    manifest = json.load(source)
actual = json.load(sys.stdin)
actual_release = actual.get("release")
actual_digest = actual.get("imageDigest")
if actual_release != expected_release:
    raise SystemExit("release mismatch: {} != {}".format(actual_release, expected_release))
if actual_digest != manifest["digest"]:
    raise SystemExit("digest mismatch: {} != {}".format(actual_digest, manifest["digest"]))
print("identity-ok release={} digest={}".format(expected_release, manifest["digest"]))
' "$manifest" "$release"
}

probe_start() {
  local scenario="$1"
  python3 "$LAB_DIR/probe.py" \
    --seconds 20 \
    --rate 10 \
    --evidence "$RUNTIME_DIR/evidence.jsonl" \
    --scenario "$scenario" &
  PROBE_PID="$!"
  sleep 2
}

probe_finish() {
  wait "$PROBE_PID"
  PROBE_PID=''
}

"$LABCTL" reset-slots

"$LABCTL" prepare blue lab-a none
"$LABCTL" switch blue
assert_identity lab-a

"$LABCTL" prepare green lab-b none
probe_start switch-lab-a-to-lab-b
"$LABCTL" switch green
probe_finish
assert_identity lab-b

if "$LABCTL" prepare blue lab-c readiness; then
  echo 'Readiness-fault candidate was not blocked.' >&2
  exit 1
fi
assert_identity lab-b

"$LABCTL" prepare blue lab-d external
probe_start external-failure-auto-rollback
if "$LABCTL" switch blue; then
  echo 'External-fault candidate was promoted.' >&2
  exit 1
fi
probe_finish
assert_identity lab-b

"$LABCTL" prepare blue lab-e none
probe_start switch-lab-b-to-lab-e
"$LABCTL" switch blue
probe_finish
assert_identity lab-e

"$LABCTL" restart-active
assert_identity lab-e

probe_start manual-rollback-lab-e-to-lab-b
"$LABCTL" rollback
probe_finish
assert_identity lab-b

echo 'All local/isolated blue-green scenarios passed.'
