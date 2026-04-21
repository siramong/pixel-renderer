import { GRID_W, GRID_H, PAL } from "../data/constants.js";
import {
  makeBuffer, setPixel, drawRect, drawHLine, drawVLine,
  drawBorderRect, drawText, drawTextRight, drawIcon,
  textWidth, applyScanlines,
} from "./buffer.js";

// ─── Uptime formatter ────────────────────────────────────────────────────────
function formatUptime(sinceIso) {
  const secs = Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000);
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── Signal bars widget ──────────────────────────────────────────────────────
function drawSignalBars(buf, x, y, numBars, active, color) {
  for (let b = 0; b < numBars; b++) {
    const bx = x + b * 3;
    const bh = b + 2;
    const by = y + (numBars - bh);
    const bc = b < active ? color : PAL.CHROME2;
    for (let i = 0; i < bh; i++) setPixel(buf, bx, by + i, bc);
  }
}

// ─── Mini sparkline / activity pulse ─────────────────────────────────────────
function drawPulse(buf, x, y, len, tick, color) {
  // Simple sine-ish stepped pulse using tick
  const wave = [0, 1, 2, 3, 2, 3, 4, 3, 2, 1, 0, 1, 2, 1, 0];
  for (let i = 0; i < len; i++) {
    const idx = (i + tick) % wave.length;
    const amplitude = wave[idx];
    // vertical bar of height 1 at offset amplitude from base
    setPixel(buf, x + i, y - amplitude, color);
    if (amplitude > 0) setPixel(buf, x + i, y - amplitude + 1, color + "88");
  }
}

// ─── Progress/loading bar ─────────────────────────────────────────────────────
function drawProgressBar(buf, x, y, w, progress, color) {
  drawHLine(buf, x, y, w, PAL.CHROME2);
  const filled = Math.floor(progress * w);
  drawHLine(buf, x, y, filled, color);
  // end cap blinking
  if (filled < w) setPixel(buf, x + filled, y, color + "aa");
}

// ─── Corner decorations ───────────────────────────────────────────────────────
function drawCornerTL(buf, x, y, size, color) {
  drawHLine(buf, x, y, size, color);
  drawVLine(buf, x, y, size, color);
}
function drawCornerBR(buf, x, y, size, color) {
  drawHLine(buf, x - size + 1, y, size, color);
  drawVLine(buf, x, y - size + 1, size, color);
}
function drawCornerTR(buf, x, y, size, color) {
  drawHLine(buf, x - size + 1, y, size, color);
  drawVLine(buf, x, y, size, color);
}
function drawCornerBL(buf, x, y, size, color) {
  drawHLine(buf, x, y, size, color);
  drawVLine(buf, x, y - size + 1, size, color);
}

// ─── MAIN FRAME RENDERER ─────────────────────────────────────────────────────
export function renderFrame(stateData, tick) {
  const buf = makeBuffer();
  const { label, color, icon, since, message } = stateData;

  // ── Layer 0: base fill ──────────────────────────────────────────────────────
  drawRect(buf, 0, 0, GRID_W, GRID_H, PAL.BG);

  // ── Layer 1: background grid dots (subtle) ─────────────────────────────────
  for (let y = 2; y < GRID_H - 2; y += 4) {
    for (let x = 2; x < GRID_W - 2; x += 6) {
      setPixel(buf, x, y, PAL.CHROME);
    }
  }

  // ── Layer 2: outer border ──────────────────────────────────────────────────
  drawBorderRect(buf, 0, 0, GRID_W, GRID_H, PAL.CHROME2);

  // ── Layer 3: inner structural lines ───────────────────────────────────────
  // Top divider at y=3
  drawHLine(buf, 1, 3, GRID_W - 2, PAL.CHROME);
  // Bottom divider at y=GRID_H-4
  drawHLine(buf, 1, GRID_H - 4, GRID_W - 2, PAL.CHROME);
  // Vertical divider after icon area
  drawVLine(buf, 18, 4, GRID_H - 8, PAL.CHROME);
  // Vertical divider before right panel
  drawVLine(buf, GRID_W - 20, 4, GRID_H - 8, PAL.CHROME);

  // ── Layer 4: status accent strip (left edge) ───────────────────────────────
  drawVLine(buf, 1, 4, GRID_H - 8, color);
  drawVLine(buf, 2, 5, GRID_H - 10, color + "66");

  // ── Layer 5: icon (10×10, vertically centered) ─────────────────────────────
  const iconH = 10;
  const iconY = Math.floor((GRID_H - iconH) / 2);
  drawIcon(buf, icon, 5, iconY, color);

  // ── Layer 6: main label ────────────────────────────────────────────────────
  const labelX = 21;
  const labelY = 6;
  drawText(buf, label, labelX, labelY, color);

  // ── Layer 7: cursor blink ──────────────────────────────────────────────────
  const cursorX = labelX + textWidth(label) + 2;
  if (Math.floor(tick / 5) % 2 === 0) {
    drawRect(buf, cursorX, labelY, 2, 7, color + "cc");
  }

  // ── Layer 10: optional message ─────────────────────────────────────────────
  if (message && message.length > 0) {
    const maxChars = Math.floor((GRID_W - 22 - 22) / 6);
    const truncated = message.slice(0, maxChars).toUpperCase();
    drawText(buf, truncated, labelX, 2, PAL.CHROME2);
  }

  // ── Layer 11: right panel ──────────────────────────────────────────────────
  const rpX = GRID_W - 18;

  // ID label bottom right
  drawTextRight(buf, "V1", GRID_W - 2, GRID_H - 2, PAL.CHROME);

  // ── Layer 12: corner bracket decorations ──────────────────────────────────
  const cs = 4; // corner size
  drawCornerTL(buf, 0,          0,          cs, PAL.CHROME2 + "ff");
  drawCornerTR(buf, GRID_W - 1, 0,          cs, PAL.CHROME2 + "ff");
  drawCornerBL(buf, 0,          GRID_H - 1, cs, PAL.CHROME2 + "ff");
  drawCornerBR(buf, GRID_W - 1, GRID_H - 1, cs, PAL.CHROME2 + "ff");

  // Bright corner dots
  setPixel(buf, 0,          0,          color + "55");
  setPixel(buf, GRID_W - 1, 0,          color + "55");
  setPixel(buf, 0,          GRID_H - 1, color + "55");
  setPixel(buf, GRID_W - 1, GRID_H - 1, color + "55");

  // ── Layer 14: scanlines (post-pass, every other row) ──────────────────────
  applyScanlines(buf);

  return buf;
}
