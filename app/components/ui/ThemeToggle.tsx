import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { useTheme } from "~/lib/theme";
import { IconButton } from "./IconButton";

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Sun that morphs into a crescent moon: the core grows, a mask bites it, the rays retract. */
export function ThemeToggle() {
  const { resolved, setPref } = useTheme();
  const dark = resolved === "dark";
  const reduced = useReducedMotion();
  // The first client render shows the server's default icon; snap (don't morph) to the
  // real theme once state syncs after hydration, then animate real toggles only.
  const live = useRef(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => (live.current = true));
    return () => cancelAnimationFrame(id);
  }, []);
  const t = { duration: reduced || !live.current ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <IconButton
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      onClick={() => setPref(dark ? "light" : "dark")}
    >
      <motion.svg
        viewBox="0 0 24 24"
        className="size-5"
        initial={false}
        animate={{ rotate: dark ? 40 : 90 }}
        transition={t}
      >
        <mask id="theme-toggle-moon">
          <rect width="24" height="24" fill="white" />
          <motion.circle initial={false} animate={{ cx: dark ? 17 : 30, cy: dark ? 7 : -4 }} transition={t} r="6" fill="black" />
        </mask>
        <motion.circle
          cx="12"
          cy="12"
          fill="currentColor"
          mask="url(#theme-toggle-moon)"
          initial={false}
          animate={{ r: dark ? 8 : 4.5 }}
          transition={t}
        />
        <motion.g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: dark ? 0 : 1, scale: dark ? 0.5 : 1 }}
          style={{ originX: "12px", originY: "12px" }}
          transition={t}
        >
          {RAYS.map((deg) => (
            <line key={deg} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${deg} 12 12)`} />
          ))}
        </motion.g>
      </motion.svg>
    </IconButton>
  );
}
