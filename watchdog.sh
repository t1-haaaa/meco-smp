#!/usr/bin/env bash
cd /workspaces/meco-smp
while true; do
  if ! pgrep -f 'server\.jar' >/dev/null 2>&1; then
    if [ -f /tmp/meco_stopped ]; then
      echo "[$(date '+%F %T')] server down - STOPPED flag set, not restarting" >> /tmp/watchdog.log
    else
      echo "[$(date '+%F %T')] server DOWN -> restarting" >> /tmp/watchdog.log
      nohup bash start.sh > /tmp/server_start.log 2>&1 &
    fi
  fi
  if ! pgrep -f 'panel-local\.js' >/dev/null 2>&1; then
    echo "[$(date '+%F %T')] panel down -> starting" >> /tmp/watchdog.log
    nohup node /workspaces/meco-panel/panel-local.js > /tmp/panel.log 2>&1 &
  fi
  if ! pgrep -f 'cloudflared tunnel' >/dev/null 2>&1; then
    echo "[$(date '+%F %T')] tunnel down -> restarting" >> /tmp/watchdog.log
    bash /workspaces/meco-smp/panel_tunnel.sh >> /tmp/watchdog.log 2>&1
  fi
  sleep 20
done
