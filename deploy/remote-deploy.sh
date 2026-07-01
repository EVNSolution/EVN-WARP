#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/evn-warp}"
BACKUP_DIR="${BACKUP_DIR:-/opt/evn-warp-backups}"
REPO_URL="${REPO_URL:-https://github.com/EVNSolution/EVN-WARP.git}"
DEPLOY_REF="${DEPLOY_REF:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-evn-warp}"
PORT="${PORT:-3000}"
SERVER_NAME="${SERVER_NAME:-warp.cleversystem.ai}"
RUN_SETUP="${RUN_SETUP:-false}"
RUN_DB_PUSH="${RUN_DB_PUSH:-true}"
SSM_APP_ENV_PARAM="${SSM_APP_ENV_PARAM:-/evn-warp/app-env}"
SSM_GITHUB_TOKEN_PARAM="${SSM_GITHUB_TOKEN_PARAM:-/evn-warp/github-token}"

if [ "$RUN_SETUP" = "true" ]; then
  /tmp/evn-setup.sh
fi

need_cmd() { command -v "$1" >/dev/null 2>&1; }
get_param() {
  local name="$1"
  if need_cmd aws; then
    aws ssm get-parameter --name "$name" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true
  fi
}

github_token="$(get_param "$SSM_GITHUB_TOKEN_PARAM")"
extra_header=()
if [ -n "$github_token" ] && [ "$github_token" != "None" ]; then
  basic="$(printf 'x-access-token:%s' "$github_token" | base64 | tr -d '\n')"
  extra_header=(-c "http.extraHeader=AUTHORIZATION: basic $basic")
fi

mkdir -p "$APP_DIR" "$BACKUP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  rm -rf "$APP_DIR"
  git "${extra_header[@]}" clone "$REPO_URL" "$APP_DIR"
  git -C "$APP_DIR" remote set-url origin "$REPO_URL"
fi

cd "$APP_DIR"
old_commit="$(git rev-parse --short HEAD 2>/dev/null || true)"
git "${extra_header[@]}" fetch --prune origin "$DEPLOY_REF"
git checkout -B deploy-target FETCH_HEAD
git reset --hard FETCH_HEAD
new_commit="$(git rev-parse --short HEAD)"

ts="$(date +%Y%m%d-%H%M%S)"
if [ -f dev.db ]; then
  cp dev.db "$BACKUP_DIR/dev-${ts}-${old_commit:-unknown}.db"
fi

app_env="$(get_param "$SSM_APP_ENV_PARAM")"
previous_auth_secret=""
if [ -f .env ]; then
  previous_auth_secret="$(grep '^AUTH_SECRET=' .env | tail -1 || true)"
fi
umask 077
if [ -n "$app_env" ] && [ "$app_env" != "None" ]; then
  printf '%s\n' "$app_env" > .env
elif [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="https://${SERVER_NAME}"
AUTH_URL="https://${SERVER_NAME}"
AUTH_TRUST_HOST="true"
AUTH_SECRET="$(openssl rand -base64 32)"
EOF
fi

grep -q '^DATABASE_URL=' .env || printf '\nDATABASE_URL="file:./dev.db"\n' >> .env
grep -q '^NEXTAUTH_URL=' .env || printf '\nNEXTAUTH_URL="https://%s"\n' "$SERVER_NAME" >> .env
grep -q '^AUTH_URL=' .env || printf '\nAUTH_URL="https://%s"\n' "$SERVER_NAME" >> .env
grep -q '^AUTH_TRUST_HOST=' .env || printf '\nAUTH_TRUST_HOST="true"\n' >> .env
if ! grep -q '^AUTH_SECRET=' .env; then
  if [ -n "$previous_auth_secret" ]; then
    printf '\n%s\n' "$previous_auth_secret" >> .env
  else
    printf '\nAUTH_SECRET="%s"\n' "$(openssl rand -base64 32)" >> .env
  fi
fi

npm ci
npx prisma generate
if [ "$RUN_DB_PUSH" = "true" ]; then
  npx prisma db push
fi

admin_email="$(node -e "const fs=require('fs');const dotenv=require('dotenv');const e=dotenv.parse(fs.readFileSync('.env'));process.stdout.write(e.ADMIN_EMAIL||'')")"
admin_password="$(node -e "const fs=require('fs');const dotenv=require('dotenv');const e=dotenv.parse(fs.readFileSync('.env'));process.stdout.write(e.ADMIN_PASSWORD||'')")"
if [ -n "$admin_email" ] && [ -n "$admin_password" ]; then
  admin_name="$(node -e "const fs=require('fs');const dotenv=require('dotenv');const e=dotenv.parse(fs.readFileSync('.env'));process.stdout.write(e.ADMIN_NAME||'관리자')")"
  admin_role="$(node -e "const fs=require('fs');const dotenv=require('dotenv');const e=dotenv.parse(fs.readFileSync('.env'));process.stdout.write(e.ADMIN_ROLE||'admin')")"
  admin_hash="$(node -e "require('bcryptjs').hash(process.argv[1],12).then(v=>process.stdout.write(v))" "$admin_password")"
  ADMIN_NAME="$admin_name" ADMIN_EMAIL="$admin_email" ADMIN_HASH="$admin_hash" ADMIN_ROLE="$admin_role" node <<'NODE' >/tmp/evn-admin.sql
const crypto = require('crypto')
const q = v => `'${String(v).replace(/'/g, "''")}'`
const id = `user-${crypto.randomUUID()}`
console.log(`INSERT INTO "User" ("id","name","email","password","role","createdAt","updatedAt") VALUES (${q(id)},${q(process.env.ADMIN_NAME)},${q(process.env.ADMIN_EMAIL)},${q(process.env.ADMIN_HASH)},${q(process.env.ADMIN_ROLE)},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT("email") DO UPDATE SET "name"=excluded."name", "password"=excluded."password", "role"=excluded."role", "updatedAt"=CURRENT_TIMESTAMP;`)
NODE
  npx prisma db execute --schema prisma/schema.prisma --stdin < /tmp/evn-admin.sql
  echo "Admin user ensured: $admin_email"
fi

npm run build

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_APP_NAME" --update-env
else
  pm2 start npm --name "$PM2_APP_NAME" -- start -- -p "$PORT"
fi
pm2 save

for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null; then
    echo "Deployed ${new_commit} to ${APP_DIR} on port ${PORT}."
    exit 0
  fi
  sleep 2
done

echo "App did not become healthy on http://127.0.0.1:${PORT}/login" >&2
exit 1
