#!/usr/bin/env bash
# =============================================================================
# start.sh - Launches the Playit.gg agent (permanent static IP tunnel for port
# 25565), prints the first-run Claim Link banner, then boots the "meco smp"
# PaperMC server with JVM flags tuned for the 16GB Codespaces instance.
#
# First run only:
#   1. A Claim Link (https://playit.gg/claim/XXXX) is printed below.
#   2. Open it in a browser, create an account, and claim the agent.
#   3. Playit.gg auto-creates a "Minecraft" tunnel on 25565 and assigns a
#      PERMANENT static IP + optional *.playit.gg domain.
#   4. That address stays the same forever - even across container restarts.
#
# Auto-authentication: if PLAYIT_SECRET is set (Codespaces secret), playit
# links without any claim step.
# =============================================================================
set -euo pipefail

echo "==> Starting Playit.gg agent (static tunnel on port 25565)..."
pkill -f "playit" 2>/dev/null || true
sleep 1
nohup playit ${PLAYIT_SECRET:+--secret "${PLAYIT_SECRET}"} > playit.log 2>&1 &

# Give the agent a moment to print the Claim Link or tunnel address.
echo "==> Reading agent output..."
for _ in $(seq 1 10); do
  CLAIM=$(grep -oE 'https://playit\.gg/claim/[A-Za-z0-9_-]+' playit.log | head -n 1 || true)
  [ -n "${CLAIM}" ] && break
  sleep 1
done

if [ -n "${CLAIM:-}" ]; then
  echo ""
  echo "============================================================================"
  echo "  FIRST-RUN CLAIM REQUIRED - open this link in your browser:"
  echo ""
  echo "    ${CLAIM}"
  echo ""
  echo "  Create an account and claim the agent. Playit.gg then assigns a"
  echo "  PERMANENT static IP for port 25565 (shown in the playit.gg dashboard"
  echo "  or on the agent's next output line)."
  echo "============================================================================"
  echo ""
else
  echo "==> No claim link found - agent may already be claimed. Checking for live tunnel..."
  sleep 3
fi

# Once claimed, the agent logs the permanent address - surface it if present.
ADDR=$(grep -E 'live at|tunnel is live|Your tunnel' playit.log | tail -n 1 || true)
if [ -n "${ADDR:-}" ]; then
  echo "==> ${ADDR}"
fi
echo "==> Agent log tail:"; tail -n 5 playit.log || true

echo ""
echo "==> Starting meco smp PaperMC server (G1GC, 10G min / 14G max heap)..."
echo "==> Server console is interactive here. Stop with Ctrl+C."
echo ""
# JVM flags tuned for the 16GB Codespaces box:
#   -Xms10G / -Xmx14G  : large heap, keep 2GB for the OS and playit agent
#   -XX:+UseG1GC       : modern low-pause garbage collector
java -Xms10G -Xmx14G \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -jar server.jar nogui

# Graceful shutdown: after the server exits (Ctrl+C), stop the playit agent.
echo "==> Server stopped - shutting down playit agent..."
pkill -f "playit" 2>/dev/null || true
exit 0
