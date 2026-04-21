const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://127.0.0.1:3050/api/spotify/callback";
const SCOPES = "user-read-currently-playing user-read-playback-state";

const TOKEN_FILE = path.join(__dirname, ".spotify-token.json");
const NOW_PLAYING_ENDPOINT =
  "https://api.spotify.com/v1/me/player/currently-playing";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";

// ── In-memory state ───────────────────────────────────────────────────────────
let refreshToken = null;
let accessToken = null;
let accessTokenExpiresAt = 0; // epoch ms
let pendingStates = new Map(); // state -> createdAt (cleanup old ones)

// Cache for now-playing to avoid hammering Spotify
let nowPlayingCache = null;
let nowPlayingCacheAt = 0;
const NOW_PLAYING_TTL_MS = 2500;

// ── Token persistence ─────────────────────────────────────────────────────────
function loadTokenFromDisk() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return;
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.refreshToken === "string") {
      refreshToken = parsed.refreshToken;
      console.log("[spotify] Refresh token loaded from disk");
    }
  } catch (error) {
    console.warn(`[spotify] Failed to load token: ${error.message}`);
  }
}

function saveTokenToDisk() {
  try {
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify({ refreshToken }, null, 2),
      "utf8",
    );
  } catch (error) {
    console.warn(`[spotify] Failed to save token: ${error.message}`);
  }
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────
function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function isAuthorized() {
  return Boolean(refreshToken);
}

function basicAuthHeader() {
  return (
    "Basic " +
    Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
  );
}

function buildLoginUrl() {
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, Date.now());

  // Cleanup states older than 10 minutes
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, createdAt] of pendingStates.entries()) {
    if (createdAt < cutoff) pendingStates.delete(key);
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  refreshToken = data.refresh_token || refreshToken;
  accessToken = data.access_token;
  accessTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  saveTokenToDisk();
}

async function refreshAccessToken() {
  if (!refreshToken) throw new Error("no refresh token");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  accessTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  // Spotify sometimes returns a new refresh token
  if (data.refresh_token) {
    refreshToken = data.refresh_token;
    saveTokenToDisk();
  }
}

async function getValidAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;
  await refreshAccessToken();
  return accessToken;
}

// ── Now playing ───────────────────────────────────────────────────────────────
function emptyNowPlaying(reason = "nothing-playing") {
  return {
    isPlaying: false,
    title: "",
    artist: "",
    albumArt: "",
    progressMs: 0,
    durationMs: 0,
    reason,
  };
}

async function fetchNowPlaying() {
  const token = await getValidAccessToken();

  const response = await fetch(NOW_PLAYING_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // 204 = nothing currently playing
  if (response.status === 204) return emptyNowPlaying("nothing-playing");

  if (response.status === 401) {
    // Token expired mid-flight — force refresh once
    await refreshAccessToken();
    const retry = await fetch(NOW_PLAYING_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (retry.status === 204) return emptyNowPlaying("nothing-playing");
    if (!retry.ok) throw new Error(`spotify api ${retry.status}`);
    return parseNowPlayingBody(await retry.json());
  }

  if (!response.ok) throw new Error(`spotify api ${response.status}`);

  const body = await response.json();
  return parseNowPlayingBody(body);
}

function parseNowPlayingBody(body) {
  if (!body || !body.item) return emptyNowPlaying("nothing-playing");

  const item = body.item;

  // Podcast episode vs track — both have name, but podcasts use show.images
  let title = item.name || "";
  let artist = "";
  let albumArt = "";

  if (item.type === "episode") {
    artist = item.show?.name || "";
    const images = item.show?.images || item.images || [];
    albumArt = images[0]?.url || "";
  } else {
    artist = Array.isArray(item.artists)
      ? item.artists.map((a) => a.name).join(", ")
      : "";
    const images = item.album?.images || [];
    albumArt = images[0]?.url || "";
  }

  return {
    isPlaying: Boolean(body.is_playing),
    title,
    artist,
    albumArt,
    progressMs: Number(body.progress_ms || 0),
    durationMs: Number(item.duration_ms || 0),
    reason: "ok",
  };
}

async function getNowPlayingCached() {
  const now = Date.now();
  if (nowPlayingCache && now - nowPlayingCacheAt < NOW_PLAYING_TTL_MS) {
    return nowPlayingCache;
  }

  try {
    nowPlayingCache = await fetchNowPlaying();
    nowPlayingCacheAt = now;
    return nowPlayingCache;
  } catch (error) {
    // On error, serve stale cache if fresh enough (< 30s), else empty
    if (nowPlayingCache && now - nowPlayingCacheAt < 30_000) {
      return nowPlayingCache;
    }
    console.warn(`[spotify] now-playing error: ${error.message}`);
    return emptyNowPlaying("error");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
function registerRoutes(app) {
  app.get("/api/spotify/status", (req, res) => {
    res.json({
      ok: true,
      data: {
        configured: isConfigured(),
        authorized: isAuthorized(),
        redirectUri: REDIRECT_URI,
      },
    });
  });

  app.get("/api/spotify/login", (req, res) => {
    if (!isConfigured()) {
      res
        .status(500)
        .send(
          "Spotify not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend/.env",
        );
      return;
    }
    res.redirect(buildLoginUrl());
  });

  app.get("/api/spotify/callback", async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      res.status(400).send(`Spotify auth error: ${error}`);
      return;
    }

    if (!code || !state || !pendingStates.has(String(state))) {
      res.status(400).send("Invalid state or missing code.");
      return;
    }

    pendingStates.delete(String(state));

    try {
      await exchangeCodeForTokens(String(code));
      res.send(
        `<html><body style="font-family:monospace;background:#0a0f17;color:#39d98a;padding:40px;">
          <h2>Spotify vinculado ✓</h2>
          <p>Ya puedes cerrar esta pestaña. El backend guardó tu refresh token.</p>
        </body></html>`,
      );
    } catch (err) {
      console.error(`[spotify] callback error: ${err.message}`);
      res.status(500).send(`Token exchange failed: ${err.message}`);
    }
  });

  app.get("/api/spotify/now-playing", async (req, res) => {
    if (!isConfigured()) {
      res.json({
        ok: true,
        data: { ...emptyNowPlaying("not-configured") },
      });
      return;
    }

    if (!isAuthorized()) {
      res.json({
        ok: true,
        data: { ...emptyNowPlaying("not-authorized") },
      });
      return;
    }

    const data = await getNowPlayingCached();
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, data });
  });
}

function init() {
  loadTokenFromDisk();
  if (!isConfigured()) {
    console.log(
      "[spotify] No credentials set. Add SPOTIFY_CLIENT_ID/SECRET to backend/.env to enable.",
    );
  } else if (!isAuthorized()) {
    console.log(
      `[spotify] Not yet authorized. Visit ${REDIRECT_URI.replace("/callback", "/login")} once to link your account.`,
    );
  } else {
    console.log("[spotify] Ready (authorized via saved refresh token)");
  }
}

module.exports = { init, registerRoutes };