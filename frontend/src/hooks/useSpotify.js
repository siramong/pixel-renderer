import { useEffect, useRef, useState } from "react";

const API_BASE = "/api";
const POLL_MS = 3000;

const EMPTY = {
  isPlaying: false,
  title: "",
  artist: "",
  albumArt: "",
  progressMs: 0,
  durationMs: 0,
  reason: "init",
};

export function useSpotify() {
  const [track, setTrack] = useState(EMPTY);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  async function fetchTrack() {
    try {
      const res = await fetch(`${API_BASE}/spotify/now-playing`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (mountedRef.current && json && json.ok && json.data) {
        setTrack(json.data);
      }
    } catch (e) {
      if (mountedRef.current) {
        setTrack({ ...EMPTY, reason: "fetch-error" });
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    fetchTrack();
    pollRef.current = setInterval(fetchTrack, POLL_MS);
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { track, refetch: fetchTrack };
}