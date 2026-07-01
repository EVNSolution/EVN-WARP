#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="${SERVER_NAME:-warp.cleversystem.ai}"
PORT="${PORT:-3000}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
APP_DIR="${APP_DIR:-/opt/evn-warp}"

need_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! need_cmd apt-get; then
  echo 'Unsupported Linux package manager. This deploy script targets the Ubuntu EC2 instance.' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx openssl unzip certbot python3-certbot-nginx


if ! swapon --show=NAME | grep -qx '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! need_cmd aws; then
  arch="$(uname -m)"
  case "$arch" in
    x86_64) aws_arch=x86_64 ;;
    aarch64|arm64) aws_arch=aarch64 ;;
    *) echo "Unsupported AWS CLI architecture: $arch" >&2; exit 1 ;;
  esac
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${aws_arch}.zip" -o /tmp/awscliv2.zip
  rm -rf /tmp/aws
  unzip -q /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install --update
fi

if ! need_cmd node || [ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! need_cmd pm2; then
  npm install -g pm2
fi

mkdir -p "$APP_DIR" /opt/evn-warp-backups

cat >"/etc/nginx/conf.d/${SERVER_NAME}.conf" <<EOF_NGINX
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
EOF_NGINX

systemctl enable nginx
nginx -t
systemctl restart nginx

if [ ! -f "/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem" ]; then
  test -n "$CERTBOT_EMAIL" || { echo 'CERTBOT_EMAIL secret is required for first HTTPS cert.' >&2; exit 1; }
  certbot --nginx --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" -d "$SERVER_NAME"
fi
