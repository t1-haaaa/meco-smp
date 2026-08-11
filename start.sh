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
echo "==> Playit agent PID: $!"

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
echo "==> Detecting available RAM to size the JVM heap..."
# Codespaces machines vary (16GB premium vs 8GB standard). Size the heap to
# ~80% of total RAM so the OS and playit agent keep headroom, capped at 12G
# (12G heap + ~2G JVM off-heap/OS fits a 15GiB box without OOM kills; no swap
# is present on these containers). Override with MC_XMX / MC_XMS env vars.
MEM_KB=$(awk '/MemTotal/{print $2}' /proc/meminfo)
MEM_GB=$((MEM_KB / 1024 / 1024))
XMX="${MC_XMX:-}"
XMS="${MC_XMS:-}"
if [ -z "${XMX}" ]; then
  HEAP_GB=$(( (MEM_GB * 80) / 100 ))
  HEAP_GB=$(( HEAP_GB > 12 ? 12 : HEAP_GB ))
  HEAP_GB=$(( HEAP_GB < 2 ? 2 : HEAP_GB ))
  XMX="${HEAP_GB}G"
fi
if [ -z "${XMS}" ]; then
  XMS_GB=$(( ${XMX%G} - 2 ))
  XMS_GB=$(( XMS_GB < 1 ? 1 : XMS_GB ))
  XMS="${XMS_GB}G"
fi
echo "==> Detected ${MEM_GB}GB RAM - using -Xms${XMS} -Xmx${XMX}"

echo "==> Starting meco smp PaperMC server (G1GC, heap ${XMS} / ${XMX})..."
echo "==> Server console is interactive here. Stop with Ctrl+C."
echo ""
# JVM flags tuned for the Codespaces box (Aikar's Flags for G1GC):
#   -Xms / -Xmx          : heap sized to available RAM (80% of total, max 12G)
#   -XX:+UseG1GC         : modern low-pause garbage collector
#   -XX:+AlwaysPreTouch  : touch heap at startup so the OS pre-allocates it
#   -XX:+PerfDisableSharedMem : avoid perf data writes to /dev/shm (read-only
#                          in some container runtimes)
#   -Daikars.new.flags=true   : G1 handles mixed collections properly
java -Xms"${XMS}" -Xmx"${XMX}" \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -XX:+AlwaysPreTouch \
  -XX:G1NewSizePercent=30 \
  -XX:G1MaxNewSizePercent=40 \
  -XX:G1HeapRegionSize=8M \
  -XX:G1ReservePercent=20 \
  -XX:G1HeapWastePercent=5 \
  -XX:G1MixedGCCountTarget=4 \
  -XX:InitiatingHeapOccupancyPercent=15 \
  -XX:G1MixedGCLiveThresholdPercent=90 \
  -XX:G1RSetUpdatingPauseTimePercent=5 \
  -XX:SurvivorRatio=32 \
  -XX:+PerfDisableSharedMem \
  -XX:MaxTenuringThreshold=1 \
  -Dusing.aikars.flags=https://mcflags.emc.gs \
  -Daikars.new.flags=true \
  -jar server.jar nogui

# Graceful shutdown: after the server exits (Ctrl+C), stop the playit agent.
echo "==> Server stopped - shutting down playit agent..."
pkill -f "playit" 2>/dev/null || true
exit 0
