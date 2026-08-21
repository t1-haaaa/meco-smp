/**
 * afk_bot.js - Permanent spectator AFK/keep-alive bot for the "meco smp" Paper 1.20.4 server.
 *
 * Keeps the server non-idle 24/7 (prevents Codespace idle shutdown and anti-AFK
 * timeouts). Handles the AuthMe authentication flow so it survives the login
 * wall, then idles silently in spectator mode.
 *
 * Flow:
 *   - Joins localhost:25565 as "KeepAlive_Bot" (online-mode=false)
 *   - On spawn: sends /login <password>; if AuthMe says not registered, sends
 *     /register <password> <password> then /login again.
 *   - After auth: gently looks around every 45s (pure rotation, no physics) to
 *     stay "active" without chat spam or GrimAC NaN crashes.
 *   - Auto-reconnects 15s after any disconnect (server restarts, kicks).
 */
const mineflayer = require("mineflayer");

const HOST = "localhost";
const PORT = 25565;
const USERNAME = "KeepAlive_Bot";
const PASSWORD = "K33p4live_2026!";
const RECONNECT_DELAY_MS = 15_000;
const AFK_INTERVAL_MS = 45_000;

let bot = null;
let afkTimer = null;
let authed = false;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sendAuth() {
  if (!bot || !bot.entity) return;
  bot.chat(`/login ${PASSWORD}`);
  log("Sent /login");
  // Fallback: if not registered yet, register then login again
  setTimeout(() => {
    if (!authed && bot && bot.entity) {
      bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
      log("Sent /register (fallback)");
      setTimeout(() => {
        if (!authed && bot && bot.entity) {
          bot.chat(`/login ${PASSWORD}`);
          log("Sent /login again after register");
        }
      }, 2500);
    }
  }, 2500);
}

function startAfkLoop(b) {
  stopAfkLoop();
  let yaw = 0;
  afkTimer = setInterval(() => {
    if (!b || !b.entity || !authed) return;
    try {
      const pos = b.entity.position;
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
      yaw = (yaw + Math.PI / 3) % (Math.PI * 2);
      b.look(yaw, 0, true);
    } catch (err) {
      log(`AFK tick error: ${err.message}`);
    }
  }, AFK_INTERVAL_MS);
  log("Silent AFK loop started (look around every 45s)");
}

function stopAfkLoop() {
  if (afkTimer) {
    clearInterval(afkTimer);
    afkTimer = null;
  }
}

function connect() {
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: "1.20.4",
  });

  bot.once("login", () => log(`Logged in to ${HOST}:${PORT} as ${USERNAME}`));
  bot.once("spawn", () => {
    authed = false;
    log("Spawned - authenticating with AuthMe...");
    bot.physicsEnabled = false;
    // AuthMe shows login prompt shortly after spawn; wait, then authenticate.
    setTimeout(sendAuth, 3000);
  });

  // Detect successful auth (success/fail messages from AuthMe)
  bot.on("message", (json) => {
    if (!json || !json.toString) return;
    const text = json.toString();
    if (/successfully logged in|successfully registered|logged in!/i.test(text)) {
      if (!authed) {
        authed = true;
        log("Authenticated successfully - entering silent spectator idle.");
        startAfkLoop(bot);
      }
    } else if (/not registered|register first/i.test(text)) {
      log("Server says not registered - will register on next attempt.");
    } else if (/wrong password|invalid password/i.test(text)) {
      log("WARN: login rejected (wrong password). Check PASSWORD constant.");
    }
  });

  bot.on("error", (err) => log(`Error: ${err.message}`));

  bot.on("end", (reason) => {
    stopAfkLoop();
    authed = false;
    log(`Disconnected (${reason}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });
}

log(`Starting permanent spectator AFK bot ${USERNAME} for ${HOST}:${PORT}...`);
connect();

process.on("SIGTERM", () => {
  log("SIGTERM received - shutting down");
  stopAfkLoop();
  if (bot) bot.end();
  process.exit(0);
});
process.on("SIGINT", () => {
  log("SIGINT received - shutting down");
  stopAfkLoop();
  if (bot) bot.end();
  process.exit(0);
});