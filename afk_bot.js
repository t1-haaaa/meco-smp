/**
 * afk_bot.js - Silent keep-alive bot for the "meco smp" Paper 1.20.4 server.
 *
 * Keeps the server non-idle (prevents Codespace idle shutdown and any
 * anti-AFK plugin timeout) WITHOUT sending a single chat message or command.
 *
 * Behavior:
 *   - Joins localhost:25565 as "KeepAliveBot" (server is online-mode=false)
 *   - Every 45s: gently looks around, then a subtle jump if on the ground
 *   - NO chat messages, NO commands, NO bot spam
 *   - Auto-reconnects 15s after any disconnect (server restarts, kicks)
 */
const mineflayer = require("mineflayer");

const HOST = "localhost";
const PORT = 25565;
const USERNAME = "KeepAliveBot";
const RECONNECT_DELAY_MS = 15_000;
const AFK_INTERVAL_MS = 45_000;

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
      // Gentle look-around: yaw sweep, no movement packets.
      const yaw = (b.entity.yaw || 0) + Math.PI / 3;
      b.look(yaw, 0, true);

      // Subtle jump only when safely on the ground - counts as activity
      // without triggering movement/velocity checks.
      setTimeout(() => {
        if (b && b.entity && b.entity.onGround) {
          b.setControlState("jump", true);
          setTimeout(() => {
            if (b) b.setControlState("jump", false);
          }, 300);
        }
      }, 500);
    } catch (err) {
      log(`AFK tick error: ${err.message}`);
    }
  }, AFK_INTERVAL_MS);
  log("Silent AFK loop started (look around + gentle jump every 45s)");
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
    log("Spawned in the world - bot is active (silent mode)");
    startAfkLoop(bot);
  });
  bot.on("error", (err) => log(`Error: ${err.message}`));

  bot.on("end", (reason) => {
    stopAfkLoop();
    log(`Disconnected (${reason}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });
}

log(`Starting silent KeepAliveBot for ${HOST}:${PORT}...`);
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