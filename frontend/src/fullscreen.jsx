// /frontend/src/fullscreen.jsx

import { PixelDisplay } from "./components/PixelDisplay.jsx";
import { useStatus } from "./hooks/useStatus.js";

export default function FullscreenApp() {
  const { status } = useStatus();

  const bgMap = {
    coding: "#001a12",
    designing: "#1a0033",
    editing: "#001233",
    busy: "#330000",
    idle: "#111111",
    away: "#332900"
  };

  const bg = bgMap[status?.state] || "#000";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ transform: "scale(3)" }}>
        <PixelDisplay stateData={status} />
      </div>
    </div>
  );
}