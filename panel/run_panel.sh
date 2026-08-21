#!/usr/bin/env bash
export PATH="/home/vscode/.local/bin:$PATH"
export PORT=8080
export GH_TOKEN=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
export CODESPACE_NAME=meco-smp-server-wvrr5r45p769cv9qv
cd /workspaces/meco-smp/panel
nohup node server.js > panel.log 2>&1 &
echo "panel pid: $!"