// Load .env (best-effort; no dependency required)
(() => {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (_) {
    /* best-effort */
  }
})();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");

const spotify = require("./spotify");

const app = express();
const PORT = Number(process.env.PORT) || 3050;
const WINDOW_MAP_PATH = path.join(__dirname, "window-map.json");
const FRONTEND_DIST_PATH = path.join(__dirname, "..", "frontend", "dist");
const FRONTEND_INDEX_PATH = path.join(FRONTEND_DIST_PATH, "index.html");
const POLL_MS = 2000;

const ICONS = {
  coding: [
    "0010000100",
    "0101001010",
    "1000101001",
    "0100010010",
    "0010000100",
    "0001111000",
    "0010000100",
    "0111111110",
    "0010000100",
    "0001111000",
  ],
  busy: [
    "0011111100",
    "0100000010",
    "1000110001",
    "1000110001",
    "1000000001",
    "1000110001",
    "1000110001",
    "0100000010",
    "0011111100",
    "0001100000",
  ],
  editing: [
    "0000000110",
    "0000001100",
    "0000011000",
    "0000110001",
    "0001100011",
    "0011000110",
    "0110001100",
    "1100011000",
    "1000110000",
    "0011100000",
  ],
  designing: [
    "0001111000",
    "0010000100",
    "0100110010",
    "1001001001",
    "1000110001",
    "1001001001",
    "0100110010",
    "0010000100",
    "0001111000",
    "0000100000",
  ],
  idle: [
    "0001111000",
    "0010000100",
    "0100000010",
    "1000000001",
    "1000000001",
    "0100000010",
    "0010000100",
    "0001111000",
    "0000000000",
    "0000000000",
  ],
  away: [
    "1111111111",
    "1000000001",
    "1011111101",
    "1010000101",
    "1010110101",
    "1010110101",
    "1010000101",
    "1011111101",
    "1000000001",
    "1111111111",
  ],
  tesis: [
    "0001111000",
    "0010000100",
    "0100000010",
    "0111111110",
    "0010000100",
    "0010110100",
    "0010010100",
    "0011111100",
    "0001001000",
    "0010000100",
  ],
  meeting: [
    "0001111000",
    "0010000100",
    "0101111010",
    "1010000101",
    "1010110101",
    "1010000101",
    "0101111010",
    "0010000100",
    "0001111000",
    "0000100000",
  ],
  music: [
    "0000011100",
    "0000010010",
    "0000010001",
    "0000011111",
    "0000011111",
    "0000110010",
    "0001100010",
    "0011000010",
    "0110001110",
    "1100011100",
  ],
  video: [
    "0000000000",
    "0011111100",
    "0100000010",
    "1000110001",
    "1001111001",
    "1001111001",
    "1000110001",
    "0100000010",
    "0011111100",
    "0000000000",
  ],
  gaming: [
    "0000000000",
    "0011111100",
    "0100000010",
    "1001100111",
    "1011111111",
    "1010010011",
    "1001111001",
    "0100000010",
    "0011111100",
    "0000000000",
  ],
  chat: [
    "0000000000",
    "0011111100",
    "0100000010",
    "1001111001",
    "1001001001",
    "1001111001",
    "0100000010",
    "0011111100",
    "0000110000",
    "0000010000",
  ],
  writing: [
    "0011111100",
    "0010000100",
    "0010110100",
    "0010000100",
    "0010110100",
    "0010000100",
    "0010110100",
    "0010000100",
    "0011111100",
    "0000000000",
  ],
  terminal: [
    "1111111111",
    "1000000001",
    "1011000001",
    "1001100001",
    "1000110001",
    "1000011001",
    "1000001101",
    "1001111111",
    "1000000001",
    "1111111111",
  ],
  browsing: [
    "0001111000",
    "0010000100",
    "0101110010",
    "1010010101",
    "1011101101",
    "1010010101",
    "0101110010",
    "0010000100",
    "0001111000",
    "0000000000",
  ],
  // NEW: heart-ish icon for social rule
  social: [
    "0110001100",
    "1111011110",
    "1111111111",
    "1111111111",
    "0111111110",
    "0011111100",
    "0001111000",
    "0000110000",
    "0000000000",
    "0000000000",
  ],
};

const FALLBACK_WINDOW_MAP = {
  defaultState: {
    id: "idle",
    label: "IDLE",
    color: "#6a7280",
    icon: "idle",
  },
  rules: [],
};

app.use(cors());
app.use(express.json());

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function getIconMatrix(iconName) {
  return ICONS[String(iconName || "").toLowerCase()] || ICONS.idle;
}

function renderStreamDeckButtonSvg(status, options = {}) {
  const size = clampNumber(options.size, 32, 512, 72);
  const color = String(status?.color || "#6a7280");
  const iconMatrix = getIconMatrix(status?.icon);

  const outerPadding = Math.max(2, Math.round(size * 0.04));
  const panelSize = size - outerPadding * 2;
  const iconGridSize = Math.floor(panelSize * 0.68);
  const cell = Math.max(2, Math.floor(iconGridSize / 10));
  const iconSize = cell * 10;
  const iconX = Math.floor((size - iconSize) / 2);
  const iconY = Math.floor((size - iconSize) / 2);

  const pixelRects = [];
  for (let y = 0; y < iconMatrix.length; y++) {
    const row = iconMatrix[y] || "";
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "1") continue;
      pixelRects.push(
        `<rect x="${iconX + x * cell}" y="${iconY + y * cell}" width="${cell}" height="${cell}" fill="${color}" />`,
      );
    }
  }

  const glowRadius = Math.max(8, Math.floor(size * 0.16));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0f17"/>
      <stop offset="100%" stop-color="#111a29"/>
    </linearGradient>
    <filter id="iconGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="${Math.max(1.6, size * 0.035)}" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.95 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${Math.floor(size * 0.12)}" ry="${Math.floor(size * 0.12)}" fill="url(#bg)"/>
  <rect x="${outerPadding}" y="${outerPadding}" width="${panelSize}" height="${panelSize}" rx="${Math.floor(size * 0.1)}" ry="${Math.floor(size * 0.1)}" fill="#0e1623" stroke="${color}" stroke-opacity="0.55" stroke-width="${Math.max(1, Math.floor(size * 0.03))}"/>
  <rect x="${outerPadding + 2}" y="${outerPadding + 2}" width="${Math.max(2, panelSize - 4)}" height="${Math.max(2, panelSize - 4)}" rx="${Math.floor(size * 0.08)}" ry="${Math.floor(size * 0.08)}" fill="none" stroke="#1e2b3d" stroke-width="1"/>
  <circle cx="${Math.floor(size / 2)}" cy="${Math.floor(size / 2)}" r="${glowRadius}" fill="${color}" fill-opacity="0.2"/>
  <g filter="url(#iconGlow)">
    ${pixelRects.join("\n    ")}
  </g>
</svg>`;
}

function normalizeState(
  state,
  fallbackState = FALLBACK_WINDOW_MAP.defaultState,
) {
  const base = { ...fallbackState, ...(state || {}) };
  return {
    id: String(base.id || fallbackState.id || "idle"),
    label: String(base.label || fallbackState.label || "IDLE"),
    color: String(base.color || fallbackState.color || "#6a7280"),
    icon: String(base.icon || fallbackState.icon || "idle"),
  };
}

function readWindowMapFile() {
  try {
    const raw = fs.readFileSync(WINDOW_MAP_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
      defaultState: normalizeState(parsed.defaultState),
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch (error) {
    console.warn(
      `[window-map] Falling back to in-memory defaults: ${error.message}`,
    );
    return FALLBACK_WINDOW_MAP;
  }
}

let windowMap = readWindowMapFile();

if (fs.existsSync(WINDOW_MAP_PATH)) {
  fs.watchFile(WINDOW_MAP_PATH, { interval: 1000 }, () => {
    windowMap = readWindowMapFile();
    console.log("[window-map] Reloaded window map");
  });
}

function runPowerShell(script) {
  const executables = ["powershell.exe", "pwsh"];

  for (const executable of executables) {
    const result = spawnSync(
      executable,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );

    if (result.error && result.error.code === "ENOENT") {
      continue;
    }

    if (typeof result.stdout === "string" && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }

  return null;
}

const GET_ACTIVE_WINDOW_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@;

$hWnd = [Win32]::GetForegroundWindow();
if ($hWnd -eq [IntPtr]::Zero) {
  [pscustomobject]@{ title = ""; processName = ""; pid = 0 } | ConvertTo-Json -Compress
  exit 0
}

$builder = New-Object System.Text.StringBuilder 512;
[Win32]::GetWindowText($hWnd, $builder, $builder.Capacity) | Out-Null;
$pid = 0;
[Win32]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null;
$processName = "";

try {
  $processName = (Get-Process -Id $pid -ErrorAction Stop).ProcessName
} catch {
  $processName = ""
}

[pscustomobject]@{
  title = $builder.ToString();
  processName = $processName;
  pid = [int]$pid;
} | ConvertTo-Json -Compress
`.trim();

function getActiveWindowInfo() {
  if (process.platform !== "win32") {
    return { title: "", processName: "", pid: 0 };
  }

  const output = runPowerShell(GET_ACTIVE_WINDOW_SCRIPT);
  if (!output) {
    return { title: "", processName: "", pid: 0 };
  }

  try {
    const parsed = JSON.parse(output);
    return {
      title: String(parsed.title || ""),
      processName: String(parsed.processName || ""),
      pid: Number(parsed.pid || 0),
    };
  } catch (error) {
    console.warn(
      `[window-map] Failed to parse active window info: ${error.message}`,
    );
    return { title: "", processName: "", pid: 0 };
  }
}

function ruleMatches(activeWindow, rule) {
  const match = rule.match || {};
  const titleIncludes = Array.isArray(match.titleIncludes)
    ? match.titleIncludes
    : [];
  const title = normalizeText(activeWindow.title);

  if (titleIncludes.length > 0) {
    const matchesTitle = titleIncludes.some((part) =>
      title.includes(normalizeText(part)),
    );
    if (matchesTitle) return true;
  }

  return false;
}

function resolveMappedState(activeWindow) {
  for (const rule of windowMap.rules) {
    if (ruleMatches(activeWindow, rule)) {
      return {
        state: normalizeState(rule.state, windowMap.defaultState),
        ruleName: rule.name || rule.state?.id || "rule",
      };
    }
  }

  return {
    state: normalizeState(windowMap.defaultState),
    ruleName: "default",
  };
}

function buildStatus(state, activeWindow, matchedRule, previousState) {
  const now = new Date().toISOString();
  const changed =
    !previousState ||
    previousState.id !== state.id ||
    previousState.label !== state.label ||
    previousState.color !== state.color ||
    previousState.icon !== state.icon;

  return {
    ...state,
    since: changed ? now : previousState.since,
    updatedAt: now,
    activeWindow: {
      title: activeWindow.title || "",
      processName: activeWindow.processName || "",
      pid: activeWindow.pid || 0,
    },
    matchedRule,
  };
}

let currentState = buildStatus(
  windowMap.defaultState,
  { title: "", processName: "", pid: 0 },
  "boot",
  null,
);

function syncStatus() {
  const activeWindow = getActiveWindowInfo();
  const resolved = resolveMappedState(activeWindow);
  const nextState = buildStatus(
    resolved.state,
    activeWindow,
    resolved.ruleName,
    currentState,
  );
  const changed =
    currentState.id !== nextState.id ||
    currentState.label !== nextState.label ||
    currentState.color !== nextState.color ||
    currentState.icon !== nextState.icon;

  currentState = nextState;

  if (changed) {
    console.log(
      `[status] ${nextState.label} <- ${activeWindow.title || "unknown"}`,
    );
  }
}

syncStatus();
const pollTimer = setInterval(syncStatus, POLL_MS);
if (typeof pollTimer.unref === "function") {
  pollTimer.unref();
}

// ── Spotify module ────────────────────────────────────────────────────────────
spotify.init();
spotify.registerRoutes(app);

// ── API routes ────────────────────────────────────────────────────────────────

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    data: currentState,
  });
});

app.get("/api/streamdeck/button.svg", (req, res) => {
  const size = clampNumber(req.query.size, 32, 512, 72);
  const svg = renderStreamDeckButtonSvg(currentState, { size });

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.send(svg);
});

app.get("/api/streamdeck/button", (req, res) => {
  const size = clampNumber(req.query.size, 32, 512, 72);
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const imagePath = `/api/streamdeck/button.svg?size=${size}`;

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.json({
    ok: true,
    data: {
      ...currentState,
      streamDeck: {
        size,
        imagePath,
        imageUrl: `${baseUrl}${imagePath}`,
      },
    },
  });
});

app.get("/api/window-map", (req, res) => {
  res.json({
    ok: true,
    data: windowMap,
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── Frontend serving ──────────────────────────────────────────────────────────
// IMPORTANT: custom page routes MUST be registered BEFORE express.static,
// otherwise the static middleware would try (and fail) to find a file named
// "fullscreen" with no extension, then fall through to the SPA catch-all which
// would serve index.html instead of the correct entry point.

if (fs.existsSync(FRONTEND_INDEX_PATH)) {
  // 1️⃣  Named entry points — registered first so static never shadows them
  app.get("/fullscreen", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_PATH, "fullscreen.html"));
  });

  app.get("/mobile", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_PATH, "mobile.html"));
  });

  // 2️⃣  Static assets (JS, CSS, images, *.html with extension, etc.)
  app.use(express.static(FRONTEND_DIST_PATH));

  // 3️⃣  SPA catch-all — serves index.html for any remaining GET that isn't
  //     an API or health route
  app.get(/^\/(?!api(?:\/|$)|health(?:\/|$)).*/, (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    res.sendFile(FRONTEND_INDEX_PATH);
  });
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// ── Server startup ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n  Pixel Renderer API`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /api/status`);
  console.log(`    GET  /api/streamdeck/button`);
  console.log(`    GET  /api/streamdeck/button.svg`);
  console.log(`    GET  /api/window-map`);
  console.log(`    GET  /api/spotify/status`);
  console.log(`    GET  /api/spotify/login`);
  console.log(`    GET  /api/spotify/now-playing`);
  console.log(`    GET  /health\n`);
});

function probeExistingApi(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/health",
        timeout: 1200,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }

          try {
            const parsed = JSON.parse(body);
            resolve(Boolean(parsed && parsed.ok === true));
          } catch (_) {
            resolve(false);
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => {
      resolve(false);
    });
  });
}

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    probeExistingApi(PORT)
      .then((isPixelRendererApi) => {
        if (isPixelRendererApi) {
          console.log(
            `\n[api] Ya hay una instancia activa en http://localhost:${PORT}.`,
          );
          process.exit(0);
          return;
        }

        console.error(
          `\n[api] Port ${PORT} ya esta en uso por otro proceso. Cierra ese proceso o usa PORT con otro valor.`,
        );
        process.exit(1);
      })
      .catch(() => {
        console.error(
          `\n[api] Port ${PORT} ya esta en uso. Cierra ese proceso o usa PORT con otro valor.`,
        );
        process.exit(1);
      });
    return;
  }

  console.error("\n[api] Error iniciando servidor:", error);
  process.exit(1);
});

function shutdown() {
  clearInterval(pollTimer);
  fs.unwatchFile(WINDOW_MAP_PATH);
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);