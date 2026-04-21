import { useEffect, useRef } from "react";
import { GRID_W, CELL_PX, PAL } from "../data/constants.js";
import { FONT } from "../data/font.js";
import { ICONS } from "../data/icons.js";
import { useSpotify } from "../hooks/useSpotify.js";

// ── Layout ───────────────────────────────────────────────────────────────────
const BAR_W = GRID_W * CELL_PX;      // 768px — matches display width
const BAR_H = 64;                    // compact
const ART_SIZE = BAR_H;              // 64×64 square
const GAP = 10;                      // space between art and text area
const TEXT_X = ART_SIZE + GAP;
const TEXT_W = BAR_W - TEXT_X - 8;   // right-side padding

// Pixel scale inside the canvas (each font pixel = PX_SCALE CSS pixels).
// Font is 5×7. Title uses scale 3 -> 15×21 tall rows; artist uses scale 2.
const TITLE_SCALE = 3;
const ARTIST_SCALE = 2;
const TITLE_CHAR_W = 5 * TITLE_SCALE + TITLE_SCALE;   // 5px glyph + 1 kerning * scale
const ARTIST_CHAR_W = 5 * ARTIST_SCALE + ARTIST_SCALE;

const TITLE_Y = 6;
const ARTIST_Y = TITLE_Y + 7 * TITLE_SCALE + 6;

// Marquee tuning
const MARQUEE_PX_PER_SEC = 30;       // speed in css pixels/second
const MARQUEE_GAP_PX = 48;           // blank gap between repetitions

// Colors
const TITLE_COLOR = "#e8eef7";
const ARTIST_COLOR = "#8a94a8";
const SPOTIFY_GREEN = "#1DB954";
const IDLE_COLOR = "#4a5260";

// ── Font helpers (draw on canvas) ─────────────────────────────────────────────
function drawGlyphCanvas(ctx, ch, x, y, scale, color) {
  const glyph = FONT[ch.toUpperCase()] ?? FONT[" "];
  ctx.fillStyle = color;
  for (let row = 0; row < glyph.length; row++) {
    const line = glyph[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] === "1") {
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}

function drawTextCanvas(ctx, text, x, y, scale, color) {
  const charW = 5 * scale + scale; // glyph + kerning
  let cx = x;
  for (const ch of text) {
    drawGlyphCanvas(ctx, ch, cx, y, scale, color);
    cx += charW;
  }
  return cx - x;
}

function drawIconCanvas(ctx, iconKey, x, y, scale, color) {
  const icon = ICONS[iconKey] || ICONS.idle;
  ctx.fillStyle = color;
  for (let row = 0; row < icon.length; row++) {
    const line = icon[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] === "1") {
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}

function sanitize(text) {
  // Strip characters not in our bitmap font; keep what we can.
  // The font supports A-Z, 0-9, and some punctuation. Unknown chars become ' '.
  let out = "";
  for (const ch of String(text || "")) {
    const up = ch.toUpperCase();
    if (FONT[up]) out += up;
    else out += " ";
  }
  // Collapse multiple spaces
  return out.replace(/\s+/g, " ").trim();
}

// ── Component ────────────────────────────────────────────────────────────────
export function SpotifyBar() {
  const { track } = useSpotify();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startTsRef = useRef(performance.now());
  const trackRef = useRef(track);

  // Keep latest track in a ref so the rAF loop doesn't need to re-subscribe
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Animation loop — draws the pixel-text side. Album art is a plain <img>.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use devicePixelRatio for crisp pixels even when browser zooms
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = TEXT_W * dpr;
    canvas.height = BAR_H * dpr;
    canvas.style.width = `${TEXT_W}px`;
    canvas.style.height = `${BAR_H}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    function loop(ts) {
      rafRef.current = requestAnimationFrame(loop);
      const t = trackRef.current;
      render(ctx, t, ts - startTsRef.current);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function render(ctx, t, elapsedMs) {
    // Background
    ctx.fillStyle = PAL.BG;
    ctx.fillRect(0, 0, TEXT_W, BAR_H);

    // Subtle top + bottom hairlines to visually connect with the display
    ctx.fillStyle = PAL.CHROME;
    ctx.fillRect(0, 0, TEXT_W, 1);
    ctx.fillRect(0, BAR_H - 1, TEXT_W, 1);

    const hasContent = t && (t.title || t.artist);
    const accentColor = t && t.isPlaying ? SPOTIFY_GREEN : IDLE_COLOR;

    // Small music icon on the left of the text area
    drawIconCanvas(ctx, "music", 2, 22, 2, accentColor);

    const leftPad = 2 + 10 * 2 + 8; // icon width at scale 2 + gap
    const textAreaX = leftPad;
    const textAreaW = TEXT_W - textAreaX - 4;

    if (!hasContent) {
      // Empty state — show a hint
      let hint = "NADA SONANDO";
      if (t && t.reason === "not-configured") hint = "SPOTIFY NO CONFIGURADO";
      else if (t && t.reason === "not-authorized") hint = "VINCULA SPOTIFY /LOGIN";
      else if (t && t.reason === "fetch-error") hint = "SIN CONEXION API";

      const sanitized = sanitize(hint);
      const w = sanitized.length * TITLE_CHAR_W;
      const x = textAreaX + Math.max(0, Math.floor((textAreaW - w) / 2));
      const y = Math.floor((BAR_H - 7 * TITLE_SCALE) / 2);
      drawTextCanvas(ctx, sanitized, x, y, TITLE_SCALE, IDLE_COLOR);
      return;
    }

    // Draw title and artist with independent marquees
    drawScrollingLine(
      ctx,
      sanitize(t.title),
      textAreaX,
      TITLE_Y,
      textAreaW,
      TITLE_SCALE,
      TITLE_CHAR_W,
      TITLE_COLOR,
      elapsedMs,
      !!t.isPlaying,
    );

    drawScrollingLine(
      ctx,
      sanitize(t.artist),
      textAreaX,
      ARTIST_Y,
      textAreaW,
      ARTIST_SCALE,
      ARTIST_CHAR_W,
      ARTIST_COLOR,
      elapsedMs,
      !!t.isPlaying,
    );

    // Progress bar at the bottom
    if (t.durationMs > 0) {
      const frac = Math.max(0, Math.min(1, t.progressMs / t.durationMs));
      ctx.fillStyle = PAL.CHROME2;
      ctx.fillRect(textAreaX, BAR_H - 4, textAreaW, 2);
      ctx.fillStyle = accentColor;
      ctx.fillRect(textAreaX, BAR_H - 4, Math.floor(textAreaW * frac), 2);
    }
  }

  function drawScrollingLine(
    ctx,
    text,
    x,
    y,
    maxW,
    scale,
    charW,
    color,
    elapsedMs,
    isPlaying,
  ) {
    if (!text) return;

    const textW = text.length * charW;

    // Clip so overflow doesn't leak into the art area
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - 1, maxW, 7 * scale + 2);
    ctx.clip();

    if (textW <= maxW) {
      drawTextCanvas(ctx, text, x, y, scale, color);
      ctx.restore();
      return;
    }

    // Marquee: text + gap, scrolls left continuously when playing, pauses otherwise
    const loopW = textW + MARQUEE_GAP_PX;
    const speed = isPlaying ? MARQUEE_PX_PER_SEC : 0;
    const offset = ((elapsedMs / 1000) * speed) % loopW;

    // Draw enough copies to cover the visible region
    let drawX = x - offset;
    while (drawX < x + maxW) {
      drawTextCanvas(ctx, text, drawX, y, scale, color);
      drawX += loopW;
    }

    ctx.restore();
  }

  // ── DOM layout ─────────────────────────────────────────────────────────────
  const albumArt = track?.albumArt || "";

  return (
    <div
      style={{
        width: BAR_W,
        height: BAR_H,
        display: "flex",
        background: PAL.BG,
        flexShrink: 0,
      }}
    >
      {/* Album art — plain img, NOT pixelated */}
      <div
        style={{
          width: ART_SIZE,
          height: ART_SIZE,
          background: "#0a0f17",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {albumArt ? (
          <img
            src={albumArt}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              imageRendering: "auto",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(135deg, #0f1724 0%, #1a2538 50%, #0f1724 100%)",
            }}
          />
        )}
      </div>

      {/* Pixel text area */}
      <div style={{ width: GAP, height: "100%", background: PAL.BG }} />
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: "pixelated",
          display: "block",
        }}
      />
    </div>
  );
}