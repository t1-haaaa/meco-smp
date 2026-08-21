'use strict';

const express = require('express');
const crypto = require('crypto');
const { execFile } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 8080;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const GH_TOKEN = process.env.GH_TOKEN || '';
const CODESPACE_NAME = process.env.CODESPACE_NAME || '';

const GH_API = 'https://api.github.com';
const STATUS_TTL_MS = 7 * 1000;

let statusCache = { at: 0, status: 'OFFLINE' };
let actionLock = false;

const app = express();
app.use(express.json());
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => res.set('Cache-Control', 'no-store'),
  })
);

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function requireAuth(req, res, next) {
  if (!AUTH_PASSWORD) return next();
  const pass = req.get('x-passcode') || req.query.passcode || '';
  if (!safeEqual(pass, AUTH_PASSWORD)) {
    return res.status(401).json({ error: 'Invalid passcode.' });
  }
  next();
}

function configComplete() {
  return Boolean(GH_TOKEN && CODESPACE_NAME);
}

function runGh(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(
      'gh',
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          GH_TOKEN,
          GH_HOST: 'github.com',
        },
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) return reject(Object.assign(err, { stderr: String(stderr).slice(0, 800) }));
        resolve(String(stdout).trim());
      }
    );
  });
}

async function codespaceState() {
  const res = await fetch(`${GH_API}/user/codespaces/${CODESPACE_NAME}`, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'meco-panel',
    },
  });
  if (!res.ok) {
    throw new Error(`codespaces API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return String(data.state || 'unknown').toLowerCase();
}

async function probeStatus() {
  if (!configComplete()) return 'OFFLINE';
  try {
    const state = await codespaceState();
    if (state === 'starting' || state === 'provisioning') return 'STARTING';
    if (state !== 'available') return 'OFFLINE';
    const out = await runGh(
      ['codespace', 'ssh', '-c', CODESPACE_NAME, '--', 'pgrep -f server[.]jar >/dev/null 2>&1 && echo ONLINE || echo OFFLINE'],
      60000
    );
    return out.includes('ONLINE') ? 'ONLINE' : 'OFFLINE';
  } catch {
    return 'OFFLINE';
  }
}

async function getStatusCached() {
  const now = Date.now();
  if (now - statusCache.at > STATUS_TTL_MS) {
    statusCache = { at: now, status: await probeStatus() };
  }
  return statusCache.status;
}

function remoteScript(kind) {
  const common =
    `cd /workspaces/meco-smp && setsid nohup bash start.sh </dev/null > server.log 2>&1 & ` +
    `( sleep 8; pkill -f play[i]t 2>/dev/null; setsid script -qec "/usr/local/bin/play[i]t" /dev/null > playit.log 2>&1 & ) </dev/null >/dev/null 2>&1 & `;
  const body =
    kind === 'restart'
      ? `pkill -f server[.]jar 2>/dev/null; sleep 4; ${common} echo RESTARTED; exit 0`
      : `${common} echo STARTED; exit 0`;
  return body;
}

async function executeAction(kind) {
  if (actionLock) {
    throw new Error('Another action is already in progress. Wait a few seconds and try again.');
  }
  actionLock = true;
  statusCache = { at: 0, status: 'STARTING' };
  try {
    const out = await runGh(
      ['codespace', 'ssh', '-c', CODESPACE_NAME, '--', remoteScript(kind)],
      240000
    );
    return out.includes('STARTED') || out.includes('RESTARTED') ? 'ok' : 'degraded';
  } finally {
    actionLock = false;
  }
}

app.get('/api/status', requireAuth, async (req, res) => {
  res.json({ status: await getStatusCached() });
});

app.post('/api/server/start', requireAuth, async (req, res) => {
  if (!configComplete()) return res.status(500).json({ error: 'GH_TOKEN / CODESPACE_NAME not configured.' });
  try {
    await executeAction('start');
    res.json({ ok: true, action: 'start', message: 'Server start command sent to the codespace.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/server/restart', requireAuth, async (req, res) => {
  if (!configComplete()) return res.status(500).json({ error: 'GH_TOKEN / CODESPACE_NAME not configured.' });
  try {
    await executeAction('restart');
    res.json({ ok: true, action: 'restart', message: 'Server restart command sent to the codespace.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`meco-panel listening on port ${PORT}`);
  if (!AUTH_PASSWORD) console.warn('WARN: AUTH_PASSWORD not set - all /api calls will fail with 500 until set.');
  if (!configComplete()) console.warn('WARN: GH_TOKEN / CODESPACE_NAME not set - actions disabled.');
});