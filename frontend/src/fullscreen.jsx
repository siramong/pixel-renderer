// /frontend/src/fullscreen.jsx
import { useRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PixelDisplay } from "./components/PixelDisplay.jsx";
import { SpotifyBar } from "./components/SpotifyBar.jsx";
import { useStatus } from "./hooks/useStatus.js";

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
  coding:    { bg: "#000d08", col: "#ed5e5e" },
  designing: { bg: "#0d0015", col: "#ff5fd1" },
  editing:   { bg: "#000c1a", col: "#38c8ff" },
  busy:      { bg: "#1a0000", col: "#ff3a3a" },
  idle:      { bg: "#080b11", col: "#6a7280" },
  away:      { bg: "#111000", col: "#8b95a7" },
  tesis:     { bg: "#0d0800", col: "#ff8c42" },
  meeting:   { bg: "#0a0a00", col: "#ffd166" },
  music:     { bg: "#001a0d", col: "#39d98a" },
  video:     { bg: "#1a0008", col: "#ff4d6d" },
  gaming:    { bg: "#05001a", col: "#7a6cff" },
  chat:      { bg: "#000d1a", col: "#5aa0ff" },
  writing:   { bg: "#0d0800", col: "#f2a65a" },
  terminal:  { bg: "#001a15", col: "#5fd3bc" },
  browsing:  { bg: "#000d1a", col: "#4cb3ff" },
  social:    { bg: "#1a000d", col: "#ff9a9e" },
};

const PX = 8;

function hex2rgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgba(hex, a) {
  const [r,g,b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function snap(v) { return Math.round(v / PX) * PX; }

// ── Matrix rain (coding, terminal) ───────────────────────────────────────────
function initMatrix(canvas, col, bg) {
  const cols = Math.floor(canvas.width / PX);
  return {
    type: "matrix", col, bg,
    drops: Array.from({ length: cols }, () => Math.floor(Math.random() * -80)),
    chars: "01アイウエカキクコサシスHXZF{}[]<>/\\|#$%".split(""),
  };
}
function drawMatrix(ctx, canvas, s) {
  ctx.fillStyle = rgba(s.bg, 0.12);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${PX}px monospace`;
  const [cr,cg,cb] = hex2rgb(s.col);
  s.drops.forEach((y, i) => {
    const ch = s.chars[Math.floor(Math.random() * s.chars.length)];
    ctx.fillStyle = Math.random() > 0.94
      ? `rgba(220,255,220,0.9)`
      : `rgba(${cr},${cg},${cb},${0.35 + Math.random() * 0.45})`;
    ctx.fillText(ch, i * PX, y * PX);
    if (y * PX > canvas.height && Math.random() > 0.975) s.drops[i] = 0;
    else s.drops[i] += 0.6;
  });
}

// ── Equalizer bars (music) ───────────────────────────────────────────────────
function initEqualizer(canvas, col, bg) {
  const count = Math.floor(canvas.width / (PX * 3));
  return {
    type: "equalizer", col, bg,
    bars: Array.from({ length: count }, () => ({
      h: Math.random() * 0.4, target: Math.random(),
      speed: 0.025 + Math.random() * 0.04,
    })),
  };
}
function drawEqualizer(ctx, canvas, s, tick) {
  ctx.fillStyle = rgba(s.bg, 0.35);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const barW = Math.floor(canvas.width / s.bars.length);
  const [cr,cg,cb] = hex2rgb(s.col);
  s.bars.forEach((bar, i) => {
    if (Math.random() > 0.96) bar.target = Math.random();
    if (tick % 18 === 0 && Math.random() > 0.5)
      bar.target = Math.min(1, bar.h + Math.random() * 0.6);
    bar.h += (bar.target - bar.h) * bar.speed;
    const maxH = canvas.height * 0.65;
    const h = Math.max(PX, Math.floor((bar.h * maxH) / PX) * PX);
    const x = i * barW + 2;
    const baseY = canvas.height - PX * 2;
    for (let py = baseY; py > baseY - h; py -= PX) {
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.15 + ((baseY - py) / h) * 0.7})`;
      ctx.fillRect(x, py, barW - 4, PX - 1);
    }
    ctx.fillStyle = `rgba(${Math.min(255,cr+80)},${Math.min(255,cg+80)},${Math.min(255,cb+80)},0.9)`;
    ctx.fillRect(x, baseY - h, barW - 4, PX - 1);
  });
}

// ── Starfield (gaming, browsing, idle) ───────────────────────────────────────
function initStarfield(canvas, col, bg) {
  return {
    type: "starfield", col, bg,
    stars: Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6, vy: Math.random() * 0.4 + 0.05,
      size: Math.random() > 0.8 ? PX * 2 : PX,
      phase: Math.random() * Math.PI * 2,
    })),
  };
}
function drawStarfield(ctx, canvas, s) {
  ctx.fillStyle = rgba(s.bg, 0.18);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cr,cg,cb] = hex2rgb(s.col);
  s.stars.forEach((star) => {
    star.x += star.vx; star.y += star.vy; star.phase += 0.04;
    if (star.y > canvas.height + PX) { star.y = -PX; star.x = Math.random() * canvas.width; }
    if (star.x < -PX) star.x = canvas.width;
    if (star.x > canvas.width + PX) star.x = 0;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.max(0.05, 0.2 + Math.sin(star.phase) * 0.25)})`;
    ctx.fillRect(snap(star.x), snap(star.y), star.size, star.size);
  });
}

// ── Scan lines (editing, video) ──────────────────────────────────────────────
function initScanlines(canvas, col, bg) {
  return {
    type: "scanlines", col, bg, offset: 0,
    noiseX: Array.from({ length: 12 }, () => ({
      x: snap(Math.random() * canvas.width), alpha: Math.random() * 0.12,
    })),
  };
}
function drawScanlines(ctx, canvas, s, tick) {
  ctx.fillStyle = rgba(s.bg, 0.45);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cr,cg,cb] = hex2rgb(s.col);
  s.offset = (s.offset + 0.8) % (PX * 6);
  for (let y = -PX * 6 + s.offset; y < canvas.height; y += PX * 6) {
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.max(0, 0.06 + Math.sin(y * 0.008 + tick * 0.04) * 0.04)})`;
    ctx.fillRect(0, Math.round(y), canvas.width, PX * 2);
  }
  if (tick % 4 === 0) {
    s.noiseX.forEach((n) => {
      if (Math.random() > 0.7) { n.x = snap(Math.random() * canvas.width); n.alpha = Math.random() * 0.1; }
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${n.alpha})`;
      ctx.fillRect(n.x, 0, PX, canvas.height);
    });
  }
}

// ── Bubbles (chat, meeting) ───────────────────────────────────────────────────
function initBubbles(canvas, col, bg) {
  return {
    type: "bubbles", col, bg,
    items: Array.from({ length: 22 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * canvas.height * 0.5,
      r: PX * (2 + Math.floor(Math.random() * 5)),
      speed: 0.25 + Math.random() * 0.6,
      alpha: 0.08 + Math.random() * 0.2,
    })),
  };
}
function drawBubbles(ctx, canvas, s) {
  ctx.fillStyle = rgba(s.bg, 0.2);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cr,cg,cb] = hex2rgb(s.col);
  s.items.forEach((b) => {
    b.y -= b.speed;
    if (b.y + b.r < 0) { b.y = canvas.height + b.r; b.x = Math.random() * canvas.width; }
    const steps = Math.ceil((2 * Math.PI * b.r) / PX) * 2;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${b.alpha})`;
      ctx.fillRect(snap(b.x + Math.cos(angle) * b.r), snap(b.y + Math.sin(angle) * b.r), PX, PX);
    }
  });
}

// ── Dot grid (designing, tesis, writing) ─────────────────────────────────────
function initGrid(canvas, col, bg) {
  const step = PX * 5;
  const nodes = [];
  for (let x = step; x < canvas.width; x += step)
    for (let y = step; y < canvas.height; y += step)
      nodes.push({ x, y, active: Math.random() > 0.8, phase: Math.random() * Math.PI * 2, speed: 0.015 + Math.random() * 0.025 });
  return { type: "grid", col, bg, nodes };
}
function drawGrid(ctx, canvas, s) {
  ctx.fillStyle = rgba(s.bg, 0.28);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cr,cg,cb] = hex2rgb(s.col);
  const step = PX * 5;
  ctx.fillStyle = `rgba(${cr},${cg},${cb},0.04)`;
  for (let x = step; x < canvas.width; x += step) ctx.fillRect(x, 0, 1, canvas.height);
  for (let y = step; y < canvas.height; y += step) ctx.fillRect(0, y, canvas.width, 1);
  s.nodes.forEach((node) => {
    node.phase += node.speed;
    if (Math.random() > 0.998) node.active = !node.active;
    const alpha = node.active ? 0.45 + Math.sin(node.phase) * 0.3 : 0.04 + Math.sin(node.phase) * 0.02;
    const size = node.active ? PX : PX / 2;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
  });
}

// ── Pulse rings (busy, away) ──────────────────────────────────────────────────
function initPulse(canvas, col, bg) {
  const maxR = Math.max(canvas.width, canvas.height) * 0.6;
  return {
    type: "pulse", col, bg,
    cx: canvas.width / 2, cy: canvas.height / 2, maxR,
    rings: Array.from({ length: 6 }, (_, i) => ({ r: (i / 6) * maxR })),
  };
}
function drawPulse(ctx, canvas, s) {
  ctx.fillStyle = rgba(s.bg, 0.3);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cr,cg,cb] = hex2rgb(s.col);
  s.rings.forEach((ring) => {
    ring.r += 0.4;
    if (ring.r > s.maxR) ring.r = 0;
    const alpha = Math.max(0, 0.25 * (1 - ring.r / s.maxR));
    const steps = Math.max(8, Math.ceil((2 * Math.PI * ring.r) / PX));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.fillRect(snap(s.cx + Math.cos(angle) * ring.r), snap(s.cy + Math.sin(angle) * ring.r), PX, PX);
    }
  });
}

// ── Animation router ──────────────────────────────────────────────────────────
const ANIM_MAP = {
  coding:"matrix", terminal:"matrix",
  music:"equalizer",
  gaming:"starfield", idle:"starfield", browsing:"starfield",
  editing:"scanlines", video:"scanlines",
  chat:"bubbles", meeting:"bubbles",
  designing:"grid", tesis:"grid", writing:"grid",
  busy:"pulse", away:"pulse", social:"bubbles",
};

function initAnimation(id, canvas) {
  if (!canvas || canvas.width === 0) return null;
  const { col, bg } = THEMES[id] || THEMES.idle;
  const type = ANIM_MAP[id] || "starfield";
  let s;
  switch (type) {
    case "matrix":    s = initMatrix(canvas, col, bg);    break;
    case "equalizer": s = initEqualizer(canvas, col, bg); break;
    case "starfield": s = initStarfield(canvas, col, bg); break;
    case "scanlines": s = initScanlines(canvas, col, bg); break;
    case "bubbles":   s = initBubbles(canvas, col, bg);   break;
    case "grid":      s = initGrid(canvas, col, bg);      break;
    case "pulse":     s = initPulse(canvas, col, bg);     break;
    default:          s = initStarfield(canvas, col, bg);
  }
  s.stateId = id;
  return s;
}

function drawAnimation(ctx, canvas, s, tick) {
  switch (s.type) {
    case "matrix":    drawMatrix(ctx, canvas, s, tick);    break;
    case "equalizer": drawEqualizer(ctx, canvas, s, tick); break;
    case "starfield": drawStarfield(ctx, canvas, s, tick); break;
    case "scanlines": drawScanlines(ctx, canvas, s, tick); break;
    case "bubbles":   drawBubbles(ctx, canvas, s, tick);   break;
    case "grid":      drawGrid(ctx, canvas, s, tick);      break;
    case "pulse":     drawPulse(ctx, canvas, s, tick);     break;
  }
}

const DISP_W = 96 * 8;
const DISP_H = 22 * 8;
const SPOTIFY_H = 64;
const STACK_GAP = 16;

function calcScale(w, h) {
  // Also account for the Spotify bar height + a small gap when scaling down.
  const needH = DISP_H + STACK_GAP + SPOTIFY_H;
  return Math.max(
    1,
    Math.min(
      Math.floor((w * 0.88) / DISP_W),
      Math.floor((h * 0.7) / needH),
      6,
    ),
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
function FullscreenApp() {
  const { status } = useStatus();
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const tickRef   = useRef(0);
  const rafRef    = useRef(null);
  const [scale, setScale] = useState(3);

  const id    = status?.id || "idle";
  const theme = THEMES[id] || THEMES.idle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      setScale(calcScale(window.innerWidth, window.innerHeight));
      animRef.current = initAnimation(id, canvas);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    animRef.current = initAnimation(id, canvas);
  }, [id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const loop = () => {
      tickRef.current++;
      const ctx = canvas.getContext("2d");
      if (animRef.current) drawAnimation(ctx, canvas, animRef.current, tickRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative", background: theme.bg }}>
      <canvas ref={canvasRef} style={{ position:"absolute", inset:0, imageRendering:"pixelated" }} />
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
      }} />
      {[{top:16,left:16},{top:16,right:16},{bottom:16,left:16},{bottom:16,right:16}].map((pos,i) => (
        <div key={i} style={{
          position:"absolute", ...pos, width:32, height:32,
          borderColor: rgba(theme.col, 0.35), borderStyle:"solid", borderWidth:0,
          ...(pos.top    !== undefined ? { borderTopWidth:2 }    : { borderBottomWidth:2 }),
          ...(pos.left   !== undefined ? { borderLeftWidth:2 }   : { borderRightWidth:2 }),
        }} />
      ))}
      <div style={{
        position:"absolute", top:24, left:"50%", transform:"translateX(-50%)",
        fontFamily:"monospace", fontSize:11, letterSpacing:"0.25em",
        color: rgba(theme.col, 0.5), textTransform:"uppercase", userSelect:"none",
      }}>
        {status?.label || "—"}
      </div>
      <div style={{
        position:"relative", zIndex:10, width:"100%", height:"100%",
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            imageRendering: "pixelated",
            filter: `drop-shadow(0 0 ${scale * 6}px ${rgba(theme.col, 0.55)})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: STACK_GAP,
          }}
        >
          <PixelDisplay stateData={status} />
          <SpotifyBar />
        </div>
      </div>
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
// REQUIRED: without this, Rollup sees no side effects and tree-shakes the
// entire module, leaving #root empty and only shared chunks in the HTML.
createRoot(document.getElementById("root")).render(<FullscreenApp />);