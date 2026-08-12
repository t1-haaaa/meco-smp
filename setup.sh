#!/usr/bin/env bash
# =============================================================================
# setup.sh - One-time environment preparation for the "meco smp" PaperMC
# server on GitHub Codespaces (4 vCPU / 16GB RAM) + Playit.gg static tunnel.
#
# Optional env vars (Codespaces secrets):
#   GH_PAT          - GitHub PAT (ghp_...) for `gh` CLI auth (optional)
#   PLAYIT_SECRET   - playit.gg agent secret for unattended re-linking
#                     (get it from playit.gg dashboard after first claim)
#
# Runtime overrides (optional):
#   MC_VERSION      - Minecraft version to fetch PaperMC for (default 1.20.4)
# =============================================================================
set -euo pipefail

MC_VERSION="${MC_VERSION:-1.20.4}"
PAPER_API="https://fill.papermc.io/v3/projects/paper"
# Pinned to v0.17.1: the classic playit agent that prints the claim link and
# runs the tunnel in one process. The newer 1.0.x CLI (daemon+frontend) fails
# to provision in Codespaces containers.
PLAYIT_URL="https://github.com/playit-cloud/playit-agent/releases/download/v0.17.1/playit-linux-amd64"

echo "==> [1/9] Updating system packages..."
sudo apt-get update
sudo apt-get install -y curl jq wget unzip tar gnupg openjdk-21-jre-headless nodejs npm

echo "==> [2/9] Installing Playit.gg agent (linux-x86_64)..."
# Always fetch a fresh copy: a stale/corrupt cached binary (e.g. an HTML
# error page saved as `playit`) breaks every later run.
rm -f ./playit
sudo rm -f /usr/local/bin/playit
curl -sL "${PLAYIT_URL}" -o playit
chmod +x playit
sudo mv playit /usr/local/bin/playit
echo "      playit agent installed ($(head -c 1 /usr/local/bin/playit >/dev/null 2>&1 && echo ok))"

echo "==> [3/9] Pre-linking playit agent with stored secret (if provided)..."
if [ -n "${PLAYIT_SECRET:-}" ]; then
  # Non-interactive link so fresh containers skip the claim-link step.
  mkdir -p "${HOME}/.config/playit"
  printf '{"agent_secret":"%s"}' "${PLAYIT_SECRET}" > "${HOME}/.config/playit/agent.json"
  echo "      Secret stored in ~/.config/playit/agent.json"
else
  echo "      No PLAYIT_SECRET - first run of start.sh will print a Claim Link."
fi

echo "==> [4/9] Fetching latest PaperMC build for Minecraft ${MC_VERSION}..."
# PaperMC's Fill API (v3): build list is newest-first, stable channel only.
BUILDS=$(curl -s "${PAPER_API}/versions/${MC_VERSION}/builds")
PAPER_BUILD=$(echo "${BUILDS}" | jq -r '[.[] | select(.channel == "STABLE")][0].id' 2>/dev/null || true)
if [ -z "${PAPER_BUILD}" ] || [ "${PAPER_BUILD}" = "null" ]; then
  echo "ERROR: No stable PaperMC build found for version ${MC_VERSION}."
  echo "       Override with:  MC_VERSION=1.21.1 bash setup.sh"
  exit 1
fi
PAPER_JAR=$(echo "${BUILDS}" | jq -r --argjson id "${PAPER_BUILD}" \
  '.[] | select(.id == $id) | .downloads["server:default"].name')
PAPER_URL=$(echo "${BUILDS}" | jq -r --argjson id "${PAPER_BUILD}" \
  '.[] | select(.id == $id) | .downloads["server:default"].url')
curl -sL -o server.jar "${PAPER_URL}"
echo "      Downloaded: ${PAPER_JAR} (build ${PAPER_BUILD})"

# -----------------------------------------------------------------------------
# Modrinth helper: download the latest jar for a project.
#   $1 = project slug   $2 = output filename   $3 = game version (default 1.20.4)
#   $4 = channel preference: "release" (default) or "latest" (any channel)
# "release" prefers stable builds and falls back to the newest build overall;
# "latest" takes the absolute newest build (needed for GrimAC, whose new
# client-protocol support ships in alpha builds before release).
# -----------------------------------------------------------------------------
modrinth_jar() {
  local slug="$1" out="$2" gv="${3:-1.20.4}" prefer="${4:-release}" gvq vers url
  # gv="*" = no game-version filter (for plugins whose Modrinth version list
  # doesn't enumerate our exact MC version, e.g. EssentialsX 2.22.0).
  if [ "${gv}" = "*" ]; then
    gvq="loaders=%5B%22paper%22%2C%22spigot%22%2C%22bukkit%22%5D"
  else
    gvq="game_versions=%5B%22${gv}%22%5D&loaders=%5B%22paper%22%2C%22spigot%22%2C%22bukkit%22%5D"
  fi
  vers=$(curl -s "https://api.modrinth.com/v2/project/${slug}/version?${gvq}")
  if [ "${prefer}" = "latest" ]; then
    url=$(echo "${vers}" | jq -r '.[0].files[0].url // empty' 2>/dev/null)
  else
    url=$(echo "${vers}" | jq -r '[.[] | select(.version_type == "release")][0].files[0].url // empty' 2>/dev/null)
    if [ -z "${url}" ] || [ "${url}" = "null" ]; then
      url=$(echo "${vers}" | jq -r '.[0].files[0].url // empty' 2>/dev/null)
    fi
  fi
  if [ -n "${url}" ] && [ "${url}" != "null" ]; then
    curl -sL -o "plugins/${out}" "${url}"
    echo "      Downloaded: plugins/${out}"
  else
    echo "WARN: No ${gv} build found for Modrinth project ${slug}"
  fi
}

echo "==> [5/9] Downloading ViaVersion ecosystem (version compatibility plugins)..."
mkdir -p plugins
# The Via family lets clients of ANY Minecraft version join the 1.20.4 server:
#   ViaVersion  - newer clients (up to latest) can join
#   ViaBackwards- older clients (back to 1.7.x) can join
#   ViaRewind   - legacy protocol support (1.7-1.8 clients on ViaBackwards)
VIA_REPOS="ViaVersion/ViaVersion ViaVersion/ViaBackwards ViaVersion/ViaRewind"
for repo in ${VIA_REPOS}; do
  plugin_name="$(basename "${repo}")"
  jar_url=$(curl -s "https://api.github.com/repos/${repo}/releases/latest" \
    | jq -r '.assets[] | select(.name | endswith(".jar")) | .browser_download_url' \
    | head -n 1)
  if [ -n "${jar_url}" ]; then
    curl -sL -o "plugins/${plugin_name}.jar" "${jar_url}"
    echo "      Downloaded: plugins/${plugin_name}.jar (${jar_url##*/})"
  else
    echo "WARN: No jar release found for ${repo}"
  fi
done

echo "==> [6/9] Downloading server plugins (Modrinth, 1.20.4)..."
mkdir -p plugins
modrinth_jar skinsrestorer SkinsRestorer.jar          # skins for cracked/offline accounts
modrinth_jar vaultunlocked Vault.jar                  # economy API (VaultUnlocked fork)
modrinth_jar worldedit WorldEdit.jar                  # world editing for admins
modrinth_jar worldguard WorldGuard.jar                # region protection
modrinth_jar multiverse-core Multiverse-Core.jar      # multi-world support
modrinth_jar clearlag++ ClearLag.jar                  # drops/entity cleanup
modrinth_jar placeholderapi PlaceholderAPI.jar        # %placeholder% support
modrinth_jar grimac GrimAC.jar 1.20.4 latest      # anti-cheat (GrimAC) - newest build for newest client protocols
modrinth_jar tab-was-taken TAB.jar                    # tablist & nametags (NEZNAMY)
modrinth_jar lifestealz LifeStealZ.jar                # lifesteal hearts mechanic
modrinth_jar essentialsx EssentialsX.jar "*"              # /spawn, /home, /tpa etc. (EssentialsX)
modrinth_jar essentialsx-spawn EssentialsXSpawn.jar "*"   # /spawn command module (matches EssentialsX)
ls -lh plugins/

echo "==> [7/9] Installing keep-alive AFK bot dependencies (mineflayer)..."
npm install --no-audit --no-fund --loglevel=error

echo "==> [8/9] Writing eula.txt and server.properties..."
echo "eula=true" > eula.txt

cat > server.properties <<'EOF'
# --- Generated by setup.sh (meco smp) ---
# motd uses \u00A7 (= §) color codes: gold+bold name, gray divider, green tag.
online-mode=false
motd=\u00A76\u00A7lWelcome to meco smp \u00A77| \u00A7a24/7 Playit.gg Hosted
server-port=25565
difficulty=normal
gamemode=survival
max-players=1000
view-distance=10
simulation-distance=10
spawn-protection=16
enable-command-block=true
level-name=world
pvp=true
white-list=false
EOF

echo "==> [9/9] Configuring GitHub CLI..."
if [ -n "${GH_PAT:-}" ]; then
  echo "${GH_PAT}" | gh auth login --with-token
  gh auth status
else
  echo "      GH_PAT not set - skipping gh authentication (optional)."
fi

echo ""
echo "Setup complete."
echo "Start the server and tunnel with:  bash start.sh"
