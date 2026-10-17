import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT, pressMotion } from "~/lib/motion";
import { useToastQueue } from "~/lib/toast";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

// The queue and its timers live in ~/lib/toast; re-exported so existing imports keep working.
export { ToastProvider, useToast, type ToastInput } from "~/lib/toast";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The visual toast stack. Render once inside <ToastProvider>. */
export function Toaster() {
  const { items, dismiss, hold, release } = useToastQueue();
  const reduced = useReducedMotion();
  const press = pressMotion(reduced);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 max-md:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem+var(--fab-clear))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduced}
            role={t.tone === "error" ? "alert" : "status"}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT }}
            // Mouse only: a touch fires pointerenter but often no pointerleave, which would pin the toast.
            onPointerEnter={(e) => e.pointerType === "mouse" && hold(t.id, "hover")}
            onPointerLeave={(e) => e.pointerType === "mouse" && release(t.id, "hover")}
            onFocus={() => hold(t.id, "focus")}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) release(t.id, "focus");
            }}
            className="glass pointer-events-auto flex w-full max-w-md items-center gap-3 py-2 pl-4 pr-2 text-sm"
          >
            {t.tone === "error" ? (
              <span aria-hidden className="mx-2 size-2 shrink-0 rounded-full bg-accent-2" />
            ) : (
              // Success: a check mark that draws itself on (already drawn under reduced motion).
              <span aria-hidden data-toast-check className="grid size-6 shrink-0 place-items-center rounded-full bg-light/15 text-light">
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                  <motion.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    initial={reduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.12, ease: EASE_OUT }}
                  />
                </svg>
              </span>
            )}
            <span className="flex-1 py-2">{t.message}</span>
            {t.action && (
              <motion.button
                type="button"
                {...press}
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className={`min-h-11 rounded-field px-3 font-semibold text-accent-ink hover:bg-accent/10 ${FOCUS_RING}`}
              >
                {t.action.label}
              </motion.button>
            )}
            <IconButton aria-label="Dismiss" className="text-muted" onClick={() => dismiss(t.id)}>
              <CloseIcon size={16} />
            </IconButton>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
