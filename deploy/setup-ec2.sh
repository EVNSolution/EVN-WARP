#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="${SERVER_NAME:-warp.cleversystem.ai}"
PORT="${PORT:-3000}"
ISSUE_CERT="${ISSUE_CERT:-false}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
APP_DIR="${APP_DIR:-/opt/evn-warp}"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

install_ubuntu() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl git nginx openssl awscli
  if ! need_cmd node || [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
  if [ "$ISSUE_CERT" = "true" ]; then
    apt-get install -y certbot python3-certbot-nginx
  fi
}

install_amazon() {
  if need_cmd dnf; then
    dnf install -y ca-certificates curl git nginx openssl awscli
    if ! need_cmd node || [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
      curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
      dnf install -y nodejs
    fi
    if [ "$ISSUE_CERT" = "true" ]; then
      dnf install -y certbot python3-certbot-nginx || dnf install -y certbot
    fi
  else
    yum install -y ca-certificates curl git nginx openssl awscli
    if ! need_cmd node || [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
      curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
      yum install -y nodejs
    fi
    if [ "$ISSUE_CERT" = "true" ]; then
      yum install -y certbot python3-certbot-nginx || yum install -y certbot
    fi
  fi
}

if need_cmd apt-get; then
  install_ubuntu
elif need_cmd dnf || need_cmd yum; then
  install_amazon
else
  echo 'Unsupported Linux package manager. Install node>=20 git nginx awscli manually.' >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(`.`)[0])')"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js >=20 is required, got $(node -v)." >&2
  exit 1
fi

if ! need_cmd pm2; then
  npm install -g pm2
fi

mkdir -p "$APP_DIR" /opt/evn-warp-backups

cat >"/etc/nginx/conf.d/${SERVER_NAME}.conf" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

systemctl enable nginx
nginx -t
systemctl restart nginx

if [ "$ISSUE_CERT" = "true" ]; then
  if [ -z "$CERTBOT_EMAIL" ]; then
    echo 'CERTBOT_EMAIL secret is required when issue_cert=true.' >&2
    exit 1
  fi
  certbot --nginx \
    --non-interactive \
    --agree-tos \
    --redirect \
    -m "$CERTBOT_EMAIL" \
    -d "$SERVER_NAME"
fi
