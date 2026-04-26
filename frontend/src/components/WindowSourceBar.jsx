import { GRID_W, CELL_PX, PAL } from "../data/constants.js";

const BAR_W = GRID_W * CELL_PX;
const BAR_H = 40;

const PROCESS_NAME_MAP = {
  "ats.exe": "American Truck Simulator",
  ats: "American Truck Simulator",
  "eurotrucks2.exe": "Euro Truck Simulator 2",
  eurotrucks2: "Euro Truck Simulator 2",
  "code.exe": "Visual Studio Code",
  code: "Visual Studio Code",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function mapProcessName(processName) {
  const clean = normalizeText(processName).toLowerCase();
  if (!clean) return "";
  return PROCESS_NAME_MAP[clean] || processName;
}

function stripWindowTitle(title) {
  const clean = normalizeText(title);
  if (!clean) return "";
  const splitters = [" - ", " | ", " — ", " :: "];
  for (const splitter of splitters) {
    if (clean.includes(splitter)) {
      const parts = clean
        .split(splitter)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    }
  }
  return clean;
}

function getSourceName(status) {
  const title = stripWindowTitle(status?.activeWindow?.title);
  const processFromWindow = mapProcessName(status?.activeWindow?.processName || "");
  const processFromStatus = mapProcessName(status?.processName || "");

  if (title && !title.toLowerCase().endsWith(".exe")) return title;
  if (processFromWindow) return processFromWindow;
  if (processFromStatus) return processFromStatus;
  if (title) return mapProcessName(title);
  return "Sin ventana activa";
}

export function WindowSourceBar({ status }) {
  const sourceName = getSourceName(status);

  return (
    <div
      style={{
        width: BAR_W,
        height: BAR_H,
        display: "flex",
        alignItems: "center",
        background: "#0a0f17",
        borderTop: `1px solid ${PAL.CHROME}`,
        borderBottom: `1px solid ${PAL.CHROME}`,
        color: "#cdd6e2",
        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
        fontSize: 22,
        fontWeight: 600,
        lineHeight: 1,
        padding: "0 10px",
        boxSizing: "border-box",
        letterSpacing: "0.02em",
      }}
    >
      <span
        title={sourceName}
        style={{
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          flex: 1,
        }}
      >
        {sourceName}
      </span>
    </div>
  );
}
