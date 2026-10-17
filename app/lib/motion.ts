import { useReducedMotion, type TargetAndTransition, type Transition, type Variants } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";

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

/* ---------- Route transitions ---------- */

/** Tab order of the top-level pages; phone route changes slide along it. */
export const ROUTE_ORDER = ["/", "/team", "/tasks", "/calendar", "/history"] as const;

const TASK_DETAIL = /^\/tasks\/[^/]+$/;
const normalise = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/**
 * Which way a route change slides on phones: 1 when the new page comes in from the right
 * (moving right along ROUTE_ORDER, or into a task's detail), -1 when it comes in from the left
 * (moving left, or leaving a task's detail, which slides back out to the right), 0 for the same
 * route or one outside the order.
 */
export function slideDirection(from: string, to: string): -1 | 0 | 1 {
  const a = normalise(from);
  const b = normalise(to);
  if (a === b) return 0;
  if (TASK_DETAIL.test(b)) return 1;
  if (TASK_DETAIL.test(a)) return -1;
  const i = (ROUTE_ORDER as readonly string[]).indexOf(a);
  const j = (ROUTE_ORDER as readonly string[]).indexOf(b);
  if (i < 0 || j < 0) return 0;
  return j > i ? 1 : -1;
}

const PAGE_SLIDE = 24;
/** Phone route slide: short and decelerating, so a tab switch never feels slow. */
export const phonePageTransition: Transition = { duration: 0.18, ease: EASE_OUT };

/**
 * Page enter/exit states for a route change in direction `dir` (see slideDirection): a
 * horizontal ±24px slide on phones, the fade/rise everywhere else.
 */
export function pageVariantsFor(dir: number, isPhone: boolean): Variants {
  if (!isPhone) return pageVariants;
  return {
    initial: { opacity: 0, x: dir * PAGE_SLIDE },
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -dir * PAGE_SLIDE },
  };
}

/**
 * pageVariantsFor resolved from motion's `custom` (the direction). The exiting page keeps the
 * props of its last render, so it reads the new direction from AnimatePresence's `custom`.
 */
export function routeVariants(isPhone: boolean): Variants {
  const at = (state: "initial" | "enter" | "exit") => (dir: number) => pageVariantsFor(dir ?? 0, isPhone)[state] as TargetAndTransition;
  return { initial: at("initial"), enter: at("enter"), exit: at("exit") };
}

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

/**
 * For lists that mix the CSS entrance with motion's own enter animation (AnimatePresence): true
 * during the list's first render only. Read it when an item mounts (see useStaggerOnMount) so
 * items of the first render stagger in, and items added later animate only through motion.
 */
export function useFirstRender(): RefObject<boolean> {
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  return first;
}

/**
 * stagger(i) for an item that mounted in its list's first render, otherwise just `className`.
 * Decided once at mount, so an item never loses its class (and its entrance) mid-animation.
 */
export function useStaggerOnMount(listFirstRender: RefObject<boolean>, i: number, className: string): { className: string; style?: CSSProperties } {
  const [entrance] = useState(() => (listFirstRender.current ? stagger(i, "rise", className) : null));
  return entrance ?? { className };
}

/**
 * stagger(i) for a block that can be display:none at some widths (the header pages pill below
 * md). A CSS animation restarts whenever its element goes from display:none to shown, so the
 * class is dropped once the first-paint entrance has ended or been cancelled, or at mount when
 * none is running (hidden then, already finished, or reduced motion). Spread it, ref included.
 * Native listeners: React has no animationcancel prop.
 */
export function useEntranceOnce<T extends HTMLElement>(
  i: number,
  direction: "rise" | "down",
  className: string,
): { ref: RefObject<T | null>; className: string; style?: CSSProperties } {
  const ref = useRef<T>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || done) return;
    if (typeof el.getAnimations === "function" && el.getAnimations().length === 0) {
      setDone(true);
      return;
    }
    // A child's own animation bubbling up does not end the pill's entrance.
    const finish = (e: Event) => {
      if (e.target === el) setDone(true);
    };
    el.addEventListener("animationend", finish);
    el.addEventListener("animationcancel", finish);
    return () => {
      el.removeEventListener("animationend", finish);
      el.removeEventListener("animationcancel", finish);
    };
  }, [done]);
  return done ? { ref, className } : { ref, ...stagger(i, direction, className) };
}

/* ---------- Sheets and menus ---------- */

/** The one transition every sheet, dialog and menu uses for its fade/pop. */
export const overlayTransition: Transition = { duration: 0.2, ease: EASE_OUT };
/** Slide-in panels (bottom sheet, right-hand slide-over). */
export const overlaySpring: Transition = { type: "spring", stiffness: 420, damping: 40 };
/** Bottom sheet enter/exit, tuned for touch. */
export const touchSpring: Transition = { type: "spring", stiffness: 420, damping: 38 };
/** Bottom sheet drag: a light rubber band above the rest position, free travel downwards. */
export const sheetDragElastic = { top: 0.08, bottom: 1 };

/**
 * Backdrop opacity for a bottom sheet dragged `y` px down: 1 at rest (or above it), falling
 * linearly to 0 at the dismiss distance.
 */
export function backdropOpacityFor(y: number, dismissDistance: number): number {
  if (!(dismissDistance > 0) || !Number.isFinite(y)) return 1;
  return Math.min(1, Math.max(0, 1 - y / dismissDistance));
}

/** Blur radius behind an open sheet's scrim (Tailwind's backdrop-blur-sm). */
export const SHEET_BLUR = "8px";
const SCRIM_SHOWN = { opacity: 1, "--sheet-blur": SHEET_BLUR };
const SCRIM_HIDDEN = { opacity: 0, "--sheet-blur": "0px" };

/**
 * A sheet's scrim fades in and its backdrop blur grows from 0 to SHEET_BLUR with it (and back on
 * exit). The blur is a CSS variable that `.sheet-scrim` (app.css) reads for both backdrop-filter
 * and its -webkit- twin. Under reduced motion the scrim starts at its final values.
 */
export function scrimMotion(reduced: boolean | null) {
  return reduced
    ? { initial: SCRIM_SHOWN, animate: SCRIM_SHOWN, exit: SCRIM_HIDDEN, transition: { duration: 0 } }
    : { initial: SCRIM_HIDDEN, animate: SCRIM_SHOWN, exit: SCRIM_HIDDEN, transition: overlayTransition };
}

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

const hoverLift = { y: -1 };
const tapPress = { scale: 0.96 };
/** Deeper press for the bottom tab bar items. */
export const tabPress = { scale: 0.94 };
/** Gentler press for large tappable cards. */
export const cardPress = { scale: 0.98 };

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

/** True while `query` matches; false on the server and during hydration (no mismatch). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = typeof window !== "undefined" ? window.matchMedia?.(query) : undefined;
      if (!mq) return () => {};
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  const matches = useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
  return useHydrated() && matches;
}

/** From Tailwind `md` (48rem) up. */
export const DESKTOP_QUERY = "(min-width: 48rem)";

/** Below Tailwind `md` (48rem). */
export const PHONE_QUERY = "(max-width: 47.99rem)";

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
