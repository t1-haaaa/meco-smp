#!/usr/bin/env bash
# Public URL for the control panel via Cloudflare quick tunnel (no account).
# Current URL written to /tmp/panel-url.txt
pkill -f 'cloudflared tunnel --url' 2>/dev/null
sleep 1
nohup /usr/local/bin/cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate > /tmp/cloudflared.log 2>&1 &
sleep 10
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1 > /tmp/panel-url.txt
echo "URL: $(cat /tmp/panel-url.txt)"
