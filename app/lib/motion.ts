import type { Transition, Variants } from "motion/react";

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
