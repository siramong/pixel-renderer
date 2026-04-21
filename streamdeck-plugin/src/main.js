/* eslint-disable no-console */
const WebSocket = require("ws");

const args = process.argv.slice(2);

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return "";
  return args[index + 1];
}

const port = Number(getArgValue("-port"));
const pluginUUID = getArgValue("-pluginUUID");
const registerEvent = getArgValue("-registerEvent");

if (!port || !pluginUUID || !registerEvent) {
  console.error("[plugin] Missing Stream Deck launch args.");
  process.exit(1);
}

const DEFAULTS = {
  apiBase: "http://127.0.0.1:3050",
  size: 144,
  pollMs: 1500,
};

const contexts = new Set();
const contextSettings = new Map();
let ws = null;
let pollTimer = null;
let inFlight = false;

function parseSettings(payload) {
  const settings = payload && payload.settings ? payload.settings : {};
  return {
    apiBase: String(settings.apiBase || DEFAULTS.apiBase).replace(/\/$/, ""),
    size: Math.max(32, Math.min(512, Number(settings.size || DEFAULTS.size))),
    pollMs: Math.max(500, Math.min(10000, Number(settings.pollMs || DEFAULTS.pollMs))),
  };
}

function send(event, context, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ event, context, payload }));
}

function setTitle(context, title) {
  send("setTitle", context, { title, target: 0 });
}

function setImage(context, imageDataUri) {
  send("setImage", context, { image: imageDataUri, target: 0, state: 0 });
}

function setSettings(context, settings) {
  send("setSettings", context, settings);
}

function getSettingsFor(context) {
  return contextSettings.get(context) || DEFAULTS;
}

async function fetchSvg(settings) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `${settings.apiBase}/api/streamdeck/button.svg?size=${settings.size}`;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "image/svg+xml,text/plain,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const svg = await response.text();
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateContext(context) {
  const settings = getSettingsFor(context);
  try {
    const dataUri = await fetchSvg(settings);
    setImage(context, dataUri);
    setTitle(context, "");
  } catch (error) {
    setTitle(context, "OFF");
    console.error(`[plugin] ${context} -> ${error.message}`);
  }
}

async function updateAll() {
  if (inFlight || contexts.size === 0) return;
  inFlight = true;

  try {
    await Promise.all(Array.from(contexts).map((context) => updateContext(context)));
  } finally {
    inFlight = false;
  }
}

function restartPollTimer() {
  const polling = Array.from(contexts)
    .map((context) => getSettingsFor(context).pollMs)
    .sort((a, b) => a - b)[0] || DEFAULTS.pollMs;

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(updateAll, polling);
  if (typeof pollTimer.unref === "function") pollTimer.unref();
}

function handleWillAppear(message) {
  const context = message.context;
  const settings = parseSettings(message.payload || {});

  contexts.add(context);
  contextSettings.set(context, settings);
  setSettings(context, settings);
  restartPollTimer();
  updateContext(context);
}

function handleWillDisappear(message) {
  const context = message.context;
  contexts.delete(context);
  contextSettings.delete(context);
  restartPollTimer();
}

function handleDidReceiveSettings(message) {
  const context = message.context;
  const settings = parseSettings(message.payload || {});
  contextSettings.set(context, settings);
  restartPollTimer();
  updateContext(context);
}

function connect() {
  ws = new WebSocket(`ws://127.0.0.1:${port}`);

  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        event: registerEvent,
        uuid: pluginUUID,
      }),
    );
    console.log("[plugin] connected");
    restartPollTimer();
  });

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch (_) {
      return;
    }

    switch (message.event) {
      case "willAppear":
        handleWillAppear(message);
        break;
      case "willDisappear":
        handleWillDisappear(message);
        break;
      case "didReceiveSettings":
        handleDidReceiveSettings(message);
        break;
      case "keyDown":
        updateContext(message.context);
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    if (pollTimer) clearInterval(pollTimer);
    contexts.clear();
    contextSettings.clear();
    setTimeout(connect, 1000);
  });

  ws.on("error", (error) => {
    console.error(`[plugin] websocket error: ${error.message}`);
  });
}

connect();
