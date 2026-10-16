import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, usePressMotion } from "~/lib/motion";

type SheetProps = { open: boolean; onClose: () => void; title: string; children: ReactNode };

const DESKTOP_QUERY = "(min-width: 48rem)"; // Tailwind `md`
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
 * Modal surface: a draggable bottom sheet below `md`, a centred dialog from `md` up.
 * Portalled to <body> after mount (renders nothing on the server). Escape, backdrop click,
 * the close button and (on mobile) a downward drag/fling all call onClose. While open, focus
 * is moved inside and trapped, body scroll is locked; focus returns to the opener on close.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const press = usePressMotion();
  const drag = useDragControls();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Leave focus alone if a child already took it (e.g. an autoFocus confirm button).
    if (panel && !panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel).focus();
    }
    return () => {
      if (opener && opener.isConnected) opener.focus();
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

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
  };

  if (!mounted) return null;

  const fade = { duration: reduced ? 0 : 0.2 };
  const panelMotion = desktop
    ? {
        initial: { opacity: 0, scale: 0.96, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: 8 },
        transition: { duration: reduced ? 0 : 0.24, ease: EASE_OUT },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
        transition: reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 40 },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
            className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            {...panelMotion}
            drag={desktop ? false : "y"}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={onDragEnd}
            className="glass relative flex max-h-[90dvh] w-full flex-col rounded-b-none pb-[env(safe-area-inset-bottom)] outline-none md:max-w-lg md:rounded-[20px] md:pb-0"
          >
            {!desktop && (
              <div
                aria-hidden
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
              <h2 id={titleId} className="flex-1 py-2 text-lg font-semibold">
                {title}
              </h2>
              <motion.button
                type="button"
                aria-label="Close"
                whileTap={press.whileTap}
                onClick={onClose}
                className="grid size-11 place-items-center rounded-xl text-muted hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </motion.button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
