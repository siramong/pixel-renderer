// /frontend/src/mobile.jsx
import { createRoot } from "react-dom/client";
import { PixelDisplay } from "./components/PixelDisplay.jsx";
import { useStatus } from "./hooks/useStatus.js";

function MobileApp() {
  const { status } = useStatus();

  // FIX: status?.state doesn't exist → use status?.label and status?.color
  const label = status?.label || "—";
  const color = status?.color || "#6a7280";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <div style={{ transform: "scale(2)", imageRendering: "pixelated" }}>
        <PixelDisplay stateData={status} />
      </div>
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
// REQUIRED: without this, Rollup sees no side effects and tree-shakes the
// entire module, leaving #root empty and only shared chunks in the HTML.
createRoot(document.getElementById("root")).render(<MobileApp />);