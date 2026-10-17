import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { EASE_OUT } from "~/lib/motion";
import { useTheme } from "~/lib/theme";
import { IconButton } from "./IconButton";

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Sun / moon theme switch. Both icons are always rendered in the same 20px box and CSS picks one
 * through the `dark` variant ([data-theme=dark], set by the init script before first paint), so
 * the right icon shows on the very first frame — no flash of the server's default while theme
 * state syncs after hydration, and the markup never depends on the theme (no hydration mismatch).
 * Only a user toggle animates: the icon pair is re-keyed and spins in (skipped under reduced
 * motion). The label is text from state, which may lag a frame without anything visible changing.
 */
export function ThemeToggle() {
  const { resolved, setPref } = useTheme();
  const dark = resolved === "dark";
  const reduced = useReducedMotion();
  const maskId = `theme-moon-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // 0 until the first click: the initial render never animates.
  const [toggles, setToggles] = useState(0);

  return (
    <IconButton
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      onClick={() => {
        setToggles((n) => n + 1);
        // Read the applied theme, not state: right even before state has synced.
        const appliedDark = document.documentElement.dataset.theme === "dark";
        setPref(appliedDark ? "light" : "dark");
      }}
    >
      <motion.span
        key={toggles}
        className="grid size-5 place-items-center"
        initial={toggles === 0 || reduced ? false : { rotate: -90, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
      >
        <svg data-icon="sun" aria-hidden viewBox="0 0 24 24" className="size-5 dark:hidden">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {RAYS.map((deg) => (
              <line key={deg} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${deg} 12 12)`} />
            ))}
          </g>
        </svg>
        <svg data-icon="moon" aria-hidden viewBox="0 0 24 24" className="hidden size-5 dark:block">
          <mask id={maskId}>
            <rect width="24" height="24" fill="white" />
            <circle cx="17" cy="7" r="6" fill="black" />
          </mask>
          <circle cx="12" cy="12" r="8" fill="currentColor" mask={`url(#${maskId})`} transform="rotate(40 12 12)" />
        </svg>
      </motion.span>
    </IconButton>
  );
}
