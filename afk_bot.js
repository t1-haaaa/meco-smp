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
  let yaw = 0;
  afkTimer = setInterval(() => {
    if (!b || !b.entity) return;
    try {
      const pos = b.entity.position;
      // Never touch the network if the entity state is not sane - NaN
      // coordinates trip GrimAC's CrashC check and spam the console.
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
        log(`Skipping AFK tick - position not finite (x=${pos ? pos.x : "?"}, y=${pos ? pos.y : "?"}, z=${pos ? pos.z : "?"})`);
        return;
      }

      // Gentle look-around only (yaw sweep) - pure rotation packets, no
      // movement, no physics. Physics is disabled for this bot to avoid
      // NaN position glitches on the floating spawn platform.
      yaw = (yaw + Math.PI / 3) % (Math.PI * 2);
      b.look(yaw, 0, true);
    } catch (err) {
      log(`AFK tick error: ${err.message}`);
    }
  }, AFK_INTERVAL_MS);
  log("Silent AFK loop started (look around every 45s, physics disabled)");
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
    // AFK bots don't need to walk: disable mineflayer physics so the
    // simulation can never produce NaN positions on the floating spawn
    // platform (which would trip GrimAC's CrashC check).
    bot.physicsEnabled = false;
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