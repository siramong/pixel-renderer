// /frontend/src/mobile.jsx

import { PixelDisplay } from "./components/PixelDisplay.jsx";
import { useStatus } from "./hooks/useStatus.js";

export default function MobileApp() {
  const { status } = useStatus();

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
      }}
    >
      <div style={{ transform: "scale(2)" }}>
        <PixelDisplay stateData={status} />
      </div>

      <div style={{ color: "white", fontFamily: "monospace" }}>
        {status?.state?.toUpperCase()}
      </div>
    </div>
  );
}