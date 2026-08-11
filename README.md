# meco smp — GitHub Codespaces PaperMC Server (Playit.gg)

Host the **meco smp** PaperMC Minecraft server inside a GitHub Codespace
(4 vCPU / 16 GB RAM) using **playit.gg** tunneling — a **permanent, static
IP / domain** that never changes. No VPS required.

## Server identity

| Setting           | Value                                                     |
|-------------------|-----------------------------------------------------------|
| Server name       | meco smp                                                  |
| MC version        | 1.20.4 (PaperMC, default)                                 |
| Protocol compat   | ViaVersion / ViaBackwards / ViaRewind (any client version)|
| MOTD              | §6**Welcome to meco smp** §7\| §a24/7 Playit.gg Hosted |
| Online mode       | `false` (cracked / offline clients allowed)               |
| Whitelist         | `false` (anyone can join)                                 |
| Port              | `25565`                                                   |
| JVM heap          | 10G min / 14G max, G1GC                                   |

## How it works

1. `.devcontainer/devcontainer.json` creates a Codespace with Java 21.
2. `setup.sh` runs automatically on creation: installs dependencies + the
   playit.gg agent, downloads the PaperMC jar (**1.20.4**), the ViaVersion
   plugin family (ViaVersion, ViaBackwards, ViaRewind) into `plugins/`,
   accepts the EULA, and writes `server.properties` with the meco smp MOTD.
3. `start.sh` starts the playit.gg agent (prints the one-time **Claim Link**),
   then boots the server.
4. After claiming, playit.gg assigns a **static IP** that never changes —
   friends can keep the same address across restarts.

---

## Step-by-step deployment

### 1. Create the repository

```bash
mkdir meco-smp && cd meco-smp
# copy setup.sh, start.sh, .devcontainer/, README.md into this folder
git init
git add .
git commit -m "meco smp - Minecraft server on Codespaces with playit.gg"
git branch -M main
git remote add origin https://github.com/<YOUR-USER>/meco-smp.git
git push -u origin main
```

> Windows note: keep LF line endings so bash scripts run in Linux.
> Run once: `git config core.autocrlf input` before committing.

### 2. (Optional) Add the GitHub PAT secret

GitHub → repo → **Settings → Secrets and variables → Codespaces → New repository secret**:

| Name     | Value               | Purpose                |
|----------|---------------------|------------------------|
| `GH_PAT` | your PAT (`ghp_...`) | Optional, for `gh` CLI |

Never commit tokens to the repo — GitHub secret scanning auto-revokes them.

### 3. Create the Codespace

- Repo page → **Code → Codespaces → Create codespace on main**.
- The container builds (Java 21) and `setup.sh` runs automatically — wait for
  the terminal prompt. Verify with `ls server.jar eula.txt` and `playit --version`.

### 4. Start the server and claim your static address (FIRST RUN ONLY)

```bash
bash start.sh
```

The console shows a banner like this:

```
============================================================================
  FIRST-RUN CLAIM REQUIRED - open this link in your browser:

    https://playit.gg/claim/AbCdEf123

  Create an account and claim the agent. Playit.gg then assigns a
  PERMANENT static IP for port 25565 (shown in the playit.gg dashboard
  or on the agent's next output line).
============================================================================
```

1. Click / open the claim link and create your free playit.gg account.
2. The agent is now linked. Playit.gg **auto-creates a "Minecraft" tunnel
   on port 25565** and assigns your permanent address.
3. Find the address in the [playit.gg dashboard](https://playit.gg/account/tunnels)
   or in the agent's output line (e.g. `Your tunnel is live at 45.63.12.34:25565`).
4. On the dashboard you can also claim a free `yourname.playit.gg` domain —
   **it never changes**, so players can bookmark it.

### 5. Connect

- Minecraft → Multiplayer → Add Server → name it `meco smp` → paste your
  static address.
- `online-mode=false` means any launcher works, including offline/"cracked"
  clients.
- The server MOTD shows **§6§lWelcome to meco smp §7| §a24/7 Playit.gg Hosted**
  in gold/gray/green.
- Server console input works directly in the Codespace terminal.

### 6. Stop / restart

- Press `Ctrl+C` (stops the server and the playit agent).
- Re-open the Codespace later and run `bash start.sh` again — same address.

---

## Making fresh containers skip the claim step

After claiming once, copy your agent secret from
**playit.gg dashboard → Agents → your agent → copy secret**, then add it as a
Codespaces secret named `PLAYIT_SECRET`. `setup.sh` pre-links new containers
and `start.sh` passes it with `playit --secret ...` — no claim link needed.

## Configuration cheatsheet

| What               | How                                                          |
|--------------------|--------------------------------------------------------------|
| Change MC version  | `MC_VERSION=1.21.1 bash setup.sh` (any version Paper builds) |
| Update Via plugins | Re-run `bash setup.sh` (pulls latest releases)               |
| Edit server props  | `server.properties`, then restart via `bash start.sh`        |
| View agent output  | `tail -f playit.log`                                         |
| Change tunnel port | playit.gg dashboard → tunnels → edit (must match server)     |
| World persistence  | Stored in `world/` on the Codespace disk — persists until the Codespace is deleted |

## Caveats

- Codespaces auto-suspend after ~30 min idle (server offline until reopened)
  and have monthly core-hour quotas — a Codespace is not an always-on host.
- The static IP persists, but the tunnel only serves while the container is awake.
- JVM heap is 10–14 GB, tuned for the 16 GB codespace machine type.
- This is a development-style setup — use real hardware for a production server.
