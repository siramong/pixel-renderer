import { GRID_W, GRID_H, PAL } from "../data/constants.js";
import { FONT } from "../data/font.js";
import { ICONS } from "../data/icons.js";

// ─── Buffer operations ────────────────────────────────────────────────────────

export function makeBuffer() {
  return Array.from({ length: GRID_H }, () => new Array(GRID_W).fill(PAL.OFF));
}

export function cloneBuffer(buf) {
  return buf.map(row => [...row]);
}

export function setPixel(buf, x, y, color) {
  if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
    buf[y][x] = color;
  }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

export function drawRect(buf, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(buf, x + dx, y + dy, color);
}

export function drawHLine(buf, x, y, len, color) {
  for (let i = 0; i < len; i++) setPixel(buf, x + i, y, color);
}

export function drawVLine(buf, x, y, len, color) {
  for (let i = 0; i < len; i++) setPixel(buf, x, y + i, color);
}

export function drawBorderRect(buf, x, y, w, h, color) {
  drawHLine(buf, x, y,         w, color);
  drawHLine(buf, x, y + h - 1, w, color);
  drawVLine(buf, x,         y, h, color);
  drawVLine(buf, x + w - 1, y, h, color);
}

// ─── Glyph / text ─────────────────────────────────────────────────────────────

export function drawChar(buf, ch, cx, cy, color) {
  const glyph = FONT[ch.toUpperCase()] ?? FONT[" "];
  for (let row = 0; row < glyph.length; row++) {
    for (let col = 0; col < glyph[row].length; col++) {
      if (glyph[row][col] === "1") setPixel(buf, cx + col, cy + row, color);
    }
  }
}

export function textWidth(text) {
  return text.length * 6; // 5px wide + 1px kerning
}

export function drawText(buf, text, x, y, color) {
  let cx = x;
  for (const ch of text) {
    drawChar(buf, ch, cx, y, color);
    cx += 6;
  }
}

// Right-aligned text helper
export function drawTextRight(buf, text, rightX, y, color) {
  drawText(buf, text, rightX - textWidth(text), y, color);
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

export function drawIcon(buf, iconKey, x, y, color, bgColor = null) {
  const icon = ICONS[iconKey] || ICONS.idle;
  if (!icon) return;
  for (let row = 0; row < icon.length; row++) {
    for (let col = 0; col < icon[row].length; col++) {
      if (icon[row][col] === "1") setPixel(buf, x + col, y + row, color);
      else if (bgColor) setPixel(buf, x + col, y + row, bgColor);
    }
  }
}

// ─── Scanlines post-pass ──────────────────────────────────────────────────────

export function applyScanlines(buf) {
  for (let y = 0; y < GRID_H; y += 2) {
    for (let x = 0; x < GRID_W; x++) {
      if (buf[y][x] === PAL.OFF || buf[y][x] === PAL.BG) {
        buf[y][x] = PAL.DIM;
      }
    }
  }
}

// ─── Transition: horizontal wipe ──────────────────────────────────────────────

export function wipeBlend(bufA, bufB, progress) {
  // progress: 0 → show bufA, 1 → show bufB
  const cutX = Math.floor(progress * GRID_W);
  const out = makeBuffer();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      out[y][x] = x < cutX ? bufB[y][x] : bufA[y][x];
    }
  }
  return out;
}

// ─── Transition: vertical scanline dissolve ───────────────────────────────────

export function dissolveBlend(bufA, bufB, progress) {
  // Dissolve row by row from top
  const cutY = Math.floor(progress * GRID_H);
  const out = makeBuffer();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      out[y][x] = y < cutY ? bufB[y][x] : bufA[y][x];
    }
  }
  return out;
}

// ─── Transition: checkerboard dither ─────────────────────────────────────────

export function ditherBlend(bufA, bufB, progress) {
  // 4 phases of 2x2 dither pattern
  const phase = Math.min(3, Math.floor(progress * 4));
  const patterns = [
    [[0,0]], // phase 0: TL of each 2x2 block
    [[0,0],[1,1]], // phase 1: TL + BR
    [[0,0],[1,1],[1,0]], // phase 2: TL+BR+TR
    [[0,0],[1,1],[1,0],[0,1]], // phase 3: all
  ];
  const active = new Set(patterns[phase].map(([dy, dx]) => `${dy},${dx}`));
  const out = makeBuffer();
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const key = `${y % 2},${x % 2}`;
      out[y][x] = active.has(key) ? bufB[y][x] : bufA[y][x];
    }
  }
  return out;
}
