import { useReducedMotion, type TargetAndTransition, type Transition, type Variants } from "motion/react";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

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

const STEP_SLIDE = 40;

/** Wizard step swap; `custom` is the direction (1 forward, -1 back). */
export const stepSlide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * STEP_SLIDE }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * STEP_SLIDE }),
};

export const indicatorSpring: Transition = { type: "spring", stiffness: 500, damping: 38 };

/* ---------- Page-load choreography ---------- */

/** Delay between consecutive content blocks (CSS: --stagger × 40ms in app.css). */
export const STAGGER_STEP_MS = 40;
/** Blocks after the 8th enter together with it, so a long list never waits long. */
export const STAGGER_MAX = 8;

type StaggerProps = { className: string; style: CSSProperties & { "--stagger": number } };

/**
 * Props for the i-th block of a page's entrance: a CSS keyframe class (.enter-rise, or
 * .enter-down for the header pills) delayed by --stagger steps. It is plain CSS, so it plays from
 * the server-rendered markup without waiting for hydration, needs no reduced-motion branch in
 * the markup (app.css drops the animation under prefers-reduced-motion) and only fills
 * backwards, so motion's own inline opacity/transform keep working afterwards. Spread it; any
 * classes of your own go in `className`: `<li {...stagger(i, "rise", "flex gap-2")} />`.
 */
export function stagger(i: number, direction: "rise" | "down" = "rise", className = ""): StaggerProps {
  const step = Math.min(Math.max(0, Math.floor(i)), STAGGER_MAX - 1);
  const enter = direction === "down" ? "enter-down" : "enter-rise";
  return { className: className ? `${enter} ${className}` : enter, style: { "--stagger": step } };
}

/* ---------- Sheets and menus ---------- */

/** The one transition every sheet, dialog and menu uses for its fade/pop. */
export const overlayTransition: Transition = { duration: 0.2, ease: EASE_OUT };
/** Slide-in panels (bottom sheet, right-hand slide-over). */
export const overlaySpring: Transition = { type: "spring", stiffness: 420, damping: 40 };

const POP_STILL = { opacity: 1, scale: 1, y: 0 };

/**
 * Fade + slight scale for a dialog or menu that pops in from `y` px away. Under reduced motion
 * every state is the resting one, so nothing (opacity included) animates.
 */
export function overlayPop(reduced: boolean | null, y: number) {
  return reduced
    ? { initial: POP_STILL, animate: POP_STILL, exit: POP_STILL, transition: { duration: 0 } }
    : { initial: { opacity: 0, scale: 0.96, y }, animate: POP_STILL, exit: { opacity: 0, scale: 0.96, y }, transition: overlayTransition };
}

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
export function usePressMotion(): PressMotion {
  return pressMotion(useReducedMotion());
}

type PressMotion = { whileHover: TargetAndTransition; whileTap: TargetAndTransition };

/** usePressMotion for a component that already reads useReducedMotion() for other reasons. */
export function pressMotion(reduced: boolean | null): PressMotion {
  return reduced ? { whileHover: STILL, whileTap: STILL } : { whileHover: hoverLift, whileTap: tapPress };
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

const noSubscribe = () => () => {};

/**
 * False on the server and while hydrating, true for anything rendered on the client after
 * hydration (including components that mount later). Unlike useMounted it is already true on a
 * late-mounting component's first render, so it can choose an entrance animation's `initial`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
