// /frontend/src/mobile.jsx
import { createRoot } from "react-dom/client";
import { PixelDisplay } from "./components/PixelDisplay.jsx";
import { SpotifyBar } from "./components/SpotifyBar.jsx";
import { useStatus } from "./hooks/useStatus.js";

function MobileApp() {
  const { status } = useStatus();

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
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          transform: "scale(2)",
          transformOrigin: "center center",
          imageRendering: "pixelated",
        }}
      >
        <PixelDisplay stateData={status} />
        <SpotifyBar />
      </div>
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
// REQUIRED: without this, Rollup sees no side effects and tree-shakes the
// entire module, leaving #root empty and only shared chunks in the HTML.
createRoot(document.getElementById("root")).render(<MobileApp />);