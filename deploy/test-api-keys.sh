#!/bin/bash
set -e
GOOGLE_KEY=$(grep -m1 "^GOOGLE_API_KEY" /opt/evn-warp/.env | cut -d= -f2- | tr -d '"')
ANTHROPIC_KEY=$(grep -m1 "^ANTHROPIC_API_KEY" /opt/evn-warp/.env | cut -d= -f2- | tr -d '"')
echo "Google key tail:      ...${GOOGLE_KEY: -10}"
echo "Google key length:    ${#GOOGLE_KEY}"
echo "Anthropic key tail:   ...${ANTHROPIC_KEY: -10}"
echo "Anthropic key length: ${#ANTHROPIC_KEY}"
echo "=== Google API test ==="
HTTP=$(curl -s -o /tmp/gres.txt -w "%{http_code}" "https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_KEY}")
echo "HTTP status: $HTTP"
python3 -c "import sys,json; d=json.load(open('/tmp/gres.txt')); print(d.get('error',{}).get('message','OK'))" 2>/dev/null || cat /tmp/gres.txt | head -c 300
