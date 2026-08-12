/**
 * afk_bot.js - Keep-Alive AFK bot for the "meco smp" Paper 1.20.4 server.
 *
 * Keeps the Codespace-hosted server busy so playit.gg / Codespace idle
 * shutdown doesn't kick in, and prevents anti-AFK kick plugins from
 * disconnecting the bot.
 *
 * Features:
 *   - Joins localhost:25565 as "KeepAliveBot" (server is online-mode=false)
 *   - Auto-registers/logs in with AuthMe if prompted in chat
 *   - Anti-AFK: swings arm + jumps every 30s
 *   - Auto-reconnect: rejoins 10s after any disconnect (server restarts, kicks)
 */
const mineflayer = require("mineflayer");

const HOST = "localhost";
const PORT = 25565;
const USERNAME = "KeepAliveBot";
const AUTHME_PASSWORD = "KeepAliveBot_Pass_2026!";
const RECONNECT_DELAY_MS = 10_000;
const AFK_INTERVAL_MS = 30_000;

let bot = null;
let afkTimer = null;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function startAfkLoop(b) {
  stopAfkLoop();
  afkTimer = setInterval(() => {
    if (!b || !b.entity) return;
    try {
      b.swingArm(); // triggers animation, counts as activity
      if (b.entity.onGround && !b.isSleeping) {
        b.setControlState("jump", true);
        setTimeout(() => b.setControlState("jump", false), 400);
      }
    } catch (err) {
      log(`AFK tick error: ${err.message}`);
    }
  }, AFK_INTERVAL_MS);
  log("Anti-AFK loop started (swing + jump every 30s)");
}

function stopAfkLoop() {
  if (afkTimer) {
    clearInterval(afkTimer);
    afkTimer = null;
  }
}

function handleChat(username, message) {
  if (username === "KeepAliveBot") return;
  const lower = message.toLowerCase();
  // AuthMe prompts (server is cracked = online-mode=false)
  if (lower.includes("register") && lower.includes("/register")) {
    log("AuthMe prompted registration - registering");
    bot.chat(`/register ${AUTHME_PASSWORD} ${AUTHME_PASSWORD}`);
  } else if (lower.includes("login") && lower.includes("/login")) {
    log("AuthMe prompted login - logging in");
    bot.chat(`/login ${AUTHME_PASSWORD}`);
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
    log("Spawned in the world - bot is active");
    startAfkLoop(bot);
  });
  bot.on("chat", (username, message) => handleChat(username, message));
  bot.on("error", (err) => log(`Error: ${err.message}`));

  bot.on("end", (reason) => {
    stopAfkLoop();
    log(`Disconnected (${reason}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });
}

log(`Starting KeepAliveBot for ${HOST}:${PORT}...`);
connect();

// Handle process signals cleanly
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