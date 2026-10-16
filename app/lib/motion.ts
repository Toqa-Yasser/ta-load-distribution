import { useReducedMotion, type TargetAndTransition, type Transition, type Variants } from "motion/react";
import { useEffect, useState } from "react";

/** Springy ease used for page and toast entrances. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const pageTransition: Transition = { duration: 0.25, ease: EASE_OUT };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

/** Same states without movement, for prefers-reduced-motion. */
export const reducedPageVariants: Variants = {
  initial: { opacity: 1, y: 0 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
};

export const indicatorSpring: Transition = { type: "spring", stiffness: 500, damping: 38 };

export const hoverLift = { y: -1 };
export const tapPress = { scale: 0.96 };

const STILL: TargetAndTransition = {};

/**
 * Hover lift + tap press for interactive elements; inert targets under prefers-reduced-motion.
 * MotionConfig reducedMotion="user" only makes transforms instant (they still jump), so the
 * targets are emptied here. The props stay defined either way: motion adds tabIndex when
 * whileTap is set, and useReducedMotion differs between SSR and the client, so dropping
 * the prop would cause a hydration mismatch.
 */
export function usePressMotion(): { whileHover: TargetAndTransition; whileTap: TargetAndTransition } {
  return useReducedMotion() ? { whileHover: STILL, whileTap: STILL } : { whileHover: hoverLift, whileTap: tapPress };
}

/**
 * False during SSR and the first client render, true after mount. Gate render output that
 * depends on client-only state (e.g. useReducedMotion) so hydration matches the server.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
