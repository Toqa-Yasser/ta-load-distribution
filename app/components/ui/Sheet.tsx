import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FOCUSABLE } from "~/lib/focus";
import { isTextEntry, useCoarsePointer } from "~/lib/pointer";
import { holdSheetOpen, openSheetCount } from "~/lib/sheet-open";
import { DESKTOP_QUERY, overlayPop, overlaySpring, scrimMotion, useMediaQuery } from "~/lib/motion";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Desktop placement: a centred dialog (default) or a full-height slide-over from the right. Phones always get the centred card. */
  side?: "center" | "right";
  /** Content of the scrolling body; an action row goes last (see SHEET_ACTIONS). */
  children: ReactNode;
};

/**
 * Row for a sheet's two action buttons, at the end of its body (Cancel + action). Below sm they split the row in equal flex
 * shares but never wrap a label: a longer label ("Delete all history") takes the extra width it
 * needs at 320px instead of breaking onto two lines. From sm they sit at natural width, right-aligned.
 */
export const SHEET_ACTIONS = "flex gap-2 *:flex-1 *:whitespace-nowrap sm:justify-end sm:*:flex-none";

/**
 * Where the visual viewport is smaller than the layout viewport (iOS Safari with the keyboard up,
 * which ignores `interactive-widget`), the sheet's container is fitted to the visible region, so
 * the flex centring places the card in the uncovered area. Elsewhere (and when pinch-zoomed) it
 * stays `inset-0`.
 */
function useKeyboardFit(open: boolean): CSSProperties | undefined {
  const [fit, setFit] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!open || !vv) return;
    // The last region applied; an unchanged one is not set again (no re-render).
    let last: { top: number; height: number } | null = null;
    const update = () => {
      const covered = window.innerHeight - vv.height;
      const zoomed = Math.abs(vv.scale - 1) > 0.01;
      const next = !zoomed && (covered > 1 || vv.offsetTop > 1) ? { top: vv.offsetTop, height: vv.height } : null;
      if (next?.top === last?.top && next?.height === last?.height) return;
      last = next;
      setFit(next);
    };
    // Viewport events fire many times per frame while the keyboard slides; apply the last one per frame.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
      setFit(null);
    };
  }, [open]);
  return fit ? { top: fit.top, height: fit.height, bottom: "auto" } : undefined;
}

/** After the keyboard (or a step change) settles, bring the focused field back into view. */
function revealSoon(el: HTMLElement) {
  requestAnimationFrame(() => el.scrollIntoView?.({ block: "nearest" }));
}

/** Id of the shell element that is made `inert` while any sheet is open (sheets portal outside it). */
export const APP_ROOT_ID = "app-root";
/** Panels of the open sheets, oldest first; focus that escapes is recovered into the last one. */
const sheetStack: HTMLElement[] = [];

function holdAppRootInert(): () => void {
  const release = holdSheetOpen();
  document.getElementById(APP_ROOT_ID)?.setAttribute("inert", "");
  return () => {
    release();
    if (openSheetCount() === 0) document.getElementById(APP_ROOT_ID)?.removeAttribute("inert");
  };
}

/**
 * Modal surface: a centred card that pops in (fade + scale + a short rise; 12px on phones, 8px
 * from `md` up), or, with `side="right"`, a right-hand slide-over from `md` up (a centred card on
 * phones). Portalled to <body> after mount (renders nothing on the server). Escape, a backdrop
 * tap and the close button all call onClose. While open, focus
 * is moved inside and trapped (and pulled back if it escapes to <body>), body scroll is locked,
 * and the app root is `inert` (counted, so stacked sheets release it only when the last closes);
 * focus returns to the opener on close.
 */
export function Sheet({ open, onClose, title, side = "center", children }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reduced = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyboardFit = useKeyboardFit(open);
  // Read by the focus effect when the sheet opens (false only while hydrating, before any sheet can open).
  const coarse = useCoarsePointer();

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
      const target = coarse ? headingRef.current : panel.querySelector<HTMLElement>("[data-autofocus]");
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
    // Shift+Tab from the first control, or from a non-tabbable focus target (the panel, the heading
    // focused on open), would otherwise leave the sheet.
    if (e.shiftKey && (active === first || !items.includes(active as HTMLElement))) {
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

  if (!mounted) return null;

  const right = desktop && side === "right";
  const panelMotion = right
    ? {
        initial: { x: "110%" },
        animate: { x: 0 },
        exit: { x: "110%" },
        transition: reduced ? { duration: 0 } : overlaySpring,
      }
    : overlayPop(reduced, desktop ? 8 : 12);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="sheet"
          style={keyboardFit}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] ${
            side === "right" ? "md:items-stretch md:justify-end md:p-3" : "md:p-6"
          }`}
        >
          <motion.div
            aria-hidden
            data-sheet-scrim
            {...scrimMotion(reduced)}
            onClick={onClose}
            // Clicking the scrim closes the sheet, so it gets the pointer.
            className="sheet-scrim absolute inset-0 cursor-pointer"
          >
            <div data-sheet-backdrop className="absolute inset-0 bg-scrim" />
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
            // min(…, 100%): never taller than the container's padded box, which shrinks to the
            // visible region when useKeyboardFit applies (the card then centres above the keyboard).
            data-keyboard-fit={keyboardFit ? "" : undefined}
            className={`glass relative flex max-h-[min(90dvh,100%)] w-full max-w-lg flex-col rounded-card outline-none${
              side === "right" ? " md:max-h-none md:max-w-md" : ""
            }`}
          >
            <div className="flex items-center gap-3 pl-5 pr-2 pt-2">
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
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
