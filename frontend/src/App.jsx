import { PixelDisplay } from "./components/PixelDisplay.jsx";
import { SpotifyBar } from "./components/SpotifyBar.jsx";
import { useStatus } from "./hooks/useStatus.js";

export default function App() {
  const { status } = useStatus();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <PixelDisplay stateData={status} />
      <SpotifyBar />
    </div>
  );
}