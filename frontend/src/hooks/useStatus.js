import { useEffect, useRef, useState } from "react";
import { PAL } from "../data/constants.js";

const API_BASE = "/api";
const POLL_MS = 2000;

const FALLBACK_STATE = {
  id: "idle",
  label: "IDLE",
  color: PAL.GRAY,
  icon: "idle",
  since:   new Date().toISOString(),
  activeWindow: null,
  matchedRule: "fallback",
};

export function useStatus() {
  const [status, setStatus] = useState(FALLBACK_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiOk, setApiOk] = useState(false);
  const pollRef = useRef(null);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setStatus(json.data);
        setApiOk(true);
        setError(null);
      }
    } catch (e) {
      setError(e.message);
      setApiOk(false);
    }
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(() => {
      fetchStatus();
    }, POLL_MS);

    return () => clearInterval(pollRef.current);
  }, []);

  return { status, loading, error, apiOk, refetch: fetchStatus };
}
