import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type InertiaOptions,
  type PanInfo,
} from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FOCUSABLE } from "~/lib/focus";
import { isCoarsePointer, isTextEntry } from "~/lib/pointer";
import { backdropOpacityFor, overlayPop, overlaySpring, overlayTransition, sheetDragElastic, touchSpring } from "~/lib/motion";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Desktop placement: a centred dialog (default) or a full-height slide-over from the right. */
  side?: "center" | "right";
  children: ReactNode;
  /**
   * Actions pinned below the scrolling body, so they stay in view when the on-screen keyboard
   * shrinks the sheet. Content whose state lives inside the body can use <SheetFooter> instead.
   */
  footer?: ReactNode;
};

type FooterSlot = { el: HTMLElement | null; claim: () => () => void };
const FooterSlotContext = createContext<FooterSlot | null>(null);

/** Renders its children into the enclosing Sheet's footer (see Sheet's `footer`). */
export function SheetFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlotContext);
  const claim = slot?.claim;
  // Sheets render only on the client, so the layout effect never runs on the server.
  useLayoutEffect(() => claim?.(), [claim]);
  return slot?.el ? createPortal(children, slot.el) : null;
}

/**
 * Where the visual viewport is smaller than the layout viewport (iOS Safari with the keyboard up,
 * which ignores `interactive-widget`), the sheet's container is fitted to the visible region.
 * Elsewhere (and when pinch-zoomed) it stays `inset-0`.
 */
function useKeyboardFit(open: boolean): CSSProperties | undefined {
  const [fit, setFit] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!open || !vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height;
      const zoomed = Math.abs(vv.scale - 1) > 0.01;
      setFit(!zoomed && (covered > 1 || vv.offsetTop > 1) ? { top: vv.offsetTop, height: vv.height } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setFit(null);
    };
  }, [open]);
  return fit ? { top: fit.top, height: fit.height, bottom: "auto" } : undefined;
}

/** After the keyboard (or a step change) settles, bring the focused field back into view. */
function revealSoon(el: HTMLElement) {
  requestAnimationFrame(() => el.scrollIntoView?.({ block: "nearest" }));
}

const DESKTOP_QUERY = "(min-width: 48rem)"; // Tailwind `md`
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;
/** `type: false` makes motion jump straight to the target, so the release snaps back without a spring. */
export const INSTANT_DRAG = { type: false } as unknown as InertiaOptions;

/** Id of the shell element that is made `inert` while any sheet is open (sheets portal outside it). */
export const APP_ROOT_ID = "app-root";
let openSheets = 0;
/** Panels of the open sheets, oldest first; focus that escapes is recovered into the last one. */
const sheetStack: HTMLElement[] = [];

function holdAppRootInert(): () => void {
  openSheets += 1;
  document.getElementById(APP_ROOT_ID)?.setAttribute("inert", "");
  return () => {
    openSheets -= 1;
    if (openSheets === 0) document.getElementById(APP_ROOT_ID)?.removeAttribute("inert");
  };
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return;
    setDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

/**
 * Modal surface: a draggable bottom sheet below `md`, a centred dialog (or, with
 * `side="right"`, a right-hand slide-over) from `md` up.
 * Portalled to <body> after mount (renders nothing on the server). Escape, backdrop click,
 * the close button and (on mobile) a downward drag/fling all call onClose. While open, focus
 * is moved inside and trapped (and pulled back if it escapes to <body>), body scroll is locked,
 * and the app root is `inert` (counted, so stacked sheets release it only when the last closes);
 * focus returns to the opener on close.
 */
export function Sheet({ open, onClose, title, side = "center", children, footer }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const drag = useDragControls();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyboardFit = useKeyboardFit(open);
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null);
  const [footerClaims, setFooterClaims] = useState(0);
  const footerSlot = useMemo<FooterSlot>(
    () => ({
      el: footerEl,
      claim: () => {
        setFooterClaims((n) => n + 1);
        return () => setFooterClaims((n) => n - 1);
      },
    }),
    [footerEl],
  );
  const hasFooter = footer != null || footerClaims > 0;
  // The bottom sheet's drag offset; the backdrop fades out as it nears the dismiss distance.
  // Enter/exit animate y in percent (a string), which leaves the backdrop to its own fade.
  const panelY = useMotionValue<number | string>(0);
  const dragOpacity = useTransform(panelY, (y) => (typeof y === "number" ? backdropOpacityFor(y, DISMISS_OFFSET) : 1));

  // Declared before the focus effect: cleanups run in order, and the opener must not be inert
  // when focus is handed back to it.
  useEffect(() => {
    if (!open) return;
    return holdAppRootInert();
  }, [open]);

  // Focus in on open, back to the opener on close. Children mark their initial focus target
  // with `data-autofocus`, not React's autoFocus: autoFocus fires during commit, before this
  // effect, so the opener would be recorded as the child itself. On a coarse pointer the heading
  // takes focus instead, so the on-screen keyboard never pops up before the sheet is seen.
  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(opener)) {
      const target = isCoarsePointer() ? headingRef.current : panel.querySelector<HTMLElement>("[data-autofocus]");
      (target ?? panel).focus();
    }
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, mounted]);

  // Register on the stack while open, so focus recovery targets the topmost sheet.
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !mounted || !panel) return;
    sheetStack.push(panel);
    return () => {
      const i = sheetStack.lastIndexOf(panel);
      if (i >= 0) sheetStack.splice(i, 1);
    };
  }, [open, mounted]);

  // While a field in the sheet has focus, keep it in view as the keyboard resizes the viewport.
  useEffect(() => {
    if (!open || !mounted) return;
    const onResize = () => {
      const active = document.activeElement;
      if (isTextEntry(active) && panelRef.current?.contains(active)) revealSoon(active);
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);
    window.addEventListener("resize", onResize);
    return () => {
      vv?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, [open, mounted]);

  // Body scroll lock.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Focus that leaves for nowhere (a click on the backdrop, the focused control unmounting)
  // lands on <body>, outside the trap; put it back on the topmost open sheet (which may be a
  // sheet stacked over this one). Checked after the event so a move to another element (a
  // stacked sheet, the opener on close) is left alone.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget) return;
    setTimeout(() => {
      const top = sheetStack[sheetStack.length - 1];
      const active = document.activeElement;
      if (top?.isConnected && (active === null || active === document.body)) top.focus();
    }, 0);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  };

  if (!mounted) return null;

  const fade = reduced ? { duration: 0 } : overlayTransition;
  const right = desktop && side === "right";
  const panelMotion = right
    ? {
        initial: { x: "110%" },
        animate: { x: 0 },
        exit: { x: "110%" },
        transition: reduced ? { duration: 0 } : overlaySpring,
      }
    : desktop
    ? overlayPop(reduced, 8)
    : {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
        transition: reduced ? { duration: 0 } : touchSpring,
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="sheet"
          style={keyboardFit}
          className={`fixed inset-0 z-50 flex items-end justify-center ${
            side === "right" ? "md:items-stretch md:justify-end md:p-3" : "md:items-center md:p-6"
          }`}
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
            // Clicking the scrim closes the sheet, so it gets the pointer.
            className="absolute inset-0 cursor-pointer"
          >
            <motion.div
              data-sheet-backdrop
              style={desktop ? undefined : { opacity: dragOpacity }}
              className="absolute inset-0 bg-scrim backdrop-blur-sm"
            />
          </motion.div>
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            {...panelMotion}
            style={desktop ? undefined : { y: panelY }}
            drag={desktop ? false : "y"}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={sheetDragElastic}
            dragTransition={reduced ? INSTANT_DRAG : undefined}
            onDragEnd={onDragEnd}
            // min(…, 100%): never taller than the container, which shrinks to the visible region
            // when useKeyboardFit applies. The footer carries the safe-area padding when present.
            className={`glass relative flex max-h-[min(90dvh,100%)] w-full flex-col rounded-b-none outline-none md:rounded-card md:pb-0 ${
              hasFooter ? "" : "pb-[env(safe-area-inset-bottom)]"
            } ${
              side === "right" ? "md:max-h-none md:max-w-md" : "md:max-w-lg"
            }`}
          >
            {!desktop && (
              <div
                aria-hidden
                data-sheet-handle
                onPointerDown={(e) => {
                  e.preventDefault(); // no text selection while dragging with a mouse
                  drag.start(e);
                }}
                className="flex h-11 shrink-0 cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
              >
                <span className="h-1.5 w-10 rounded-full bg-ink/20" />
              </div>
            )}
            <div className="flex items-center gap-3 pl-5 pr-2 md:pt-2">
              <h2
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="flex-1 rounded-field py-2 text-heading font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent"
              >
                {title}
              </h2>
              <IconButton aria-label="Close" className="text-muted" onClick={onClose}>
                <CloseIcon size={16} />
              </IconButton>
            </div>
            <div
              onFocusCapture={(e) => {
                if (isTextEntry(e.target)) revealSoon(e.target);
              }}
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 ${hasFooter ? "pb-3" : "pb-5"}`}
            >
              <FooterSlotContext.Provider value={footerSlot}>{children}</FooterSlotContext.Provider>
            </div>
            <div
              ref={setFooterEl}
              data-sheet-footer
              hidden={!hasFooter}
              className="shrink-0 border-t border-line bg-surface/80 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              {footer}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
