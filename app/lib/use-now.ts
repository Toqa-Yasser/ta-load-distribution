import { useEffect, useState } from "react";

/**
 * The current time in ms, refreshed every `intervalMs` while mounted; null on the server and the
 * first client render, so text derived from it hydrates cleanly.
 */
export function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
