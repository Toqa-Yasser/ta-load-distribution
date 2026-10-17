import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT, useHydrated } from "~/lib/motion";
import { usePendingGlobal } from "~/lib/use-pending";

/** Pending must last this long before the bar appears, so quick navigations never flash it. */
export const PROGRESS_DELAY_MS = 120;
const FADE_MS = 200;
const START_PCT = 8;
const HOLD_PCT = 80;

type Phase = "idle" | "running" | "done";

/**
 * Thin accent bar on the top edge while a navigation or command is pending. Appears after 120ms,
 * creeps from 8% towards 80% with a decelerating ramp, jumps to 100% and fades out when everything
 * is idle. Renders nothing when idle, on the server and before hydration.
 */
export function TopProgress() {
  const hydrated = useHydrated();
  const reduced = useReducedMotion();
  const pending = usePendingGlobal();
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  useEffect(() => {
    if (pending) {
      if (phaseRef.current === "done") {
        setRun((r) => r + 1);
        setPhase("running");
        return;
      }
      if (phaseRef.current === "running") return;
      const t = setTimeout(() => {
        setRun((r) => r + 1);
        setPhase("running");
      }, PROGRESS_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (phaseRef.current !== "running") return;
    setPhase("done");
    const t = setTimeout(() => setPhase("idle"), reduced ? 0 : FADE_MS);
    return () => clearTimeout(t);
  }, [pending, reduced]);

  if (!hydrated || phase === "idle") return null;

  const done = phase === "done";
  const className = "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-accent shadow-[0_0_8px_var(--accent)]";
  const aria = {
    role: "progressbar",
    "aria-label": "Loading",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": done ? 100 : START_PCT,
  } as const;

  if (reduced) return <div {...aria} className={className} style={{ width: done ? "100%" : `${HOLD_PCT}%` }} />;

  return (
    <motion.div
      key={run}
      {...aria}
      className={className}
      initial={{ width: `${START_PCT}%`, opacity: 1 }}
      animate={done ? { width: "100%", opacity: 0 } : { width: `${HOLD_PCT}%`, opacity: 1 }}
      transition={done ? { width: { duration: 0.1 }, opacity: { duration: FADE_MS / 1000, ease: EASE_OUT } } : { width: { duration: 8, ease: EASE_OUT } }}
    />
  );
}
