import { useRef, useEffect } from "react";
import { GRID_W, GRID_H, CELL_PX } from "../data/constants.js";
import { usePixelRenderer } from "../hooks/usePixelRenderer.js";

export function PixelDisplay({ stateData }) {
  const wrapRef = useRef(null);
  const { mountGrid } = usePixelRenderer(stateData);

  useEffect(() => {
    if (wrapRef.current) mountGrid(wrapRef.current);
  }, [mountGrid]);

  return (
    <div
      ref={wrapRef}
      style={{
        width:  GRID_W * CELL_PX,
        height: GRID_H * CELL_PX,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}
