import { useEffect, useRef, useMemo } from "react";
import { GRID_W, GRID_H, CELL_PX, FPS, FRAME_MS, PAL } from "../data/constants.js";
import { makeBuffer, wipeBlend, dissolveBlend, ditherBlend } from "../engine/buffer.js";
import { renderFrame } from "../engine/renderer.js";

const TRANSITION_MODES = ["wipe", "dissolve", "dither"];

// ─── Imperative pixel grid (zero React re-renders during animation) ──────────
export function useImperativeGrid() {
  const containerRef = useRef(null);
  const cellsRef = useRef([]);

  const domGrid = useMemo(() => {
    const cells = [];
    const container = document.createElement("div");
    container.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${GRID_W}, ${CELL_PX}px);
      grid-template-rows: repeat(${GRID_H}, ${CELL_PX}px);
      gap: 0;
      image-rendering: pixelated;
    `;

    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const cell = document.createElement("div");
      cell.style.cssText = `width:${CELL_PX}px;height:${CELL_PX}px;background-color:${PAL.BG}`;
      container.appendChild(cell);
      cells.push(cell);
    }

    cellsRef.current = cells;
    return container;
  }, []);

  function paintBuffer(flatPixels) {
    const cells = cellsRef.current;
    for (let i = 0; i < flatPixels.length; i++) {
      if (cells[i] && cells[i].style.backgroundColor !== flatPixels[i]) {
        cells[i].style.backgroundColor = flatPixels[i];
      }
    }
  }

  function mountGrid(el) {
    if (el && !el.contains(domGrid)) {
      el.innerHTML = "";
      el.appendChild(domGrid);
    }
    containerRef.current = el;
  }

  return { mountGrid, paintBuffer };
}

// ─── Main render loop hook ───────────────────────────────────────────────────
export function usePixelRenderer(stateData) {
  const { mountGrid, paintBuffer } = useImperativeGrid();

  const tickRef        = useRef(0);
  const prevBufRef     = useRef(null);
  const transRef       = useRef(1);       // 0 = start of transition, 1 = done
  const transSpeed     = useRef(0.15);
  const transModeRef   = useRef("wipe");
  const prevStateRef   = useRef(null);
  const rafRef         = useRef(null);
  const lastFrameRef   = useRef(0);
  const stateDataRef   = useRef(stateData);

  // Keep stateData ref current
  useEffect(() => {
    stateDataRef.current = stateData;
  }, [stateData]);

  // Detect state id change → trigger transition
  useEffect(() => {
    if (!stateData) return;
    const prev = prevStateRef.current;
    if (prev && prev.id !== stateData.id) {
      // Capture last rendered frame as transition source
      prevBufRef.current = renderFrame(prev, tickRef.current);
      transRef.current   = 0;
      // Cycle through transition modes
      const idx = TRANSITION_MODES.indexOf(transModeRef.current);
      transModeRef.current = TRANSITION_MODES[(idx + 1) % TRANSITION_MODES.length];
    }
    prevStateRef.current = stateData;
  }, [stateData?.id]);

  // Animation loop
  useEffect(() => {
    function loop(ts) {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - lastFrameRef.current < FRAME_MS) return;
      lastFrameRef.current = ts;
      tickRef.current++;

      const sd = stateDataRef.current;
      if (!sd) return;

      const targetBuf = renderFrame(sd, tickRef.current);
      let display;

      if (transRef.current < 1 && prevBufRef.current) {
        transRef.current = Math.min(1, transRef.current + transSpeed.current);
        const t = transRef.current;
        switch (transModeRef.current) {
          case "wipe":     display = wipeBlend(prevBufRef.current, targetBuf, t);     break;
          case "dissolve": display = dissolveBlend(prevBufRef.current, targetBuf, t); break;
          case "dither":   display = ditherBlend(prevBufRef.current, targetBuf, t);   break;
          default:         display = targetBuf;
        }
      } else {
        display = targetBuf;
      }

      paintBuffer(display.flat());
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { mountGrid };
}
