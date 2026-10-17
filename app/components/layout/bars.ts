/**
 * Hide-on-scroll for the fixed bars (header cluster, phone tab bar): they slide out of view
 * while the page scrolls down and back on the way up (see useScrollDirection). Transform only,
 * so the layout padding (--header-h, --tabbar-h) never changes and the content does not reflow.
 * Instant under reduced motion. A keyboard-focused control inside a hidden bar brings it back.
 */
export const BAR_SLIDE =
  "transition-transform duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none has-[:focus-visible]:translate-y-0";
/** Header: up and out by its own height plus the 12px top gap. */
export const HEADER_HIDDEN = "-translate-y-[calc(100%+12px)]";
/** Tab bar: down and out by its height, its 12px offset and the safe area. */
export const TABBAR_HIDDEN = "translate-y-[calc(100%+12px+env(safe-area-inset-bottom))]";
