import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT, pressMotion } from "~/lib/motion";
import { useToastQueue } from "~/lib/toast";

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
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
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
            onMouseEnter={() => hold(t.id, "hover")}
            onMouseLeave={() => release(t.id, "hover")}
            onFocus={() => hold(t.id, "focus")}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) release(t.id, "focus");
            }}
            className="glass pointer-events-auto flex w-full max-w-md items-center gap-3 py-2 pl-4 pr-2 text-sm"
          >
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${t.tone === "error" ? "bg-accent-2" : "bg-mint"}`}
            />
            <span className="flex-1 py-2">{t.message}</span>
            {t.action && (
              <motion.button
                type="button"
                {...press}
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className={`min-h-11 rounded-xl px-3 font-semibold text-accent-ink hover:bg-accent/10 ${FOCUS_RING}`}
              >
                {t.action.label}
              </motion.button>
            )}
            <motion.button
              type="button"
              aria-label="Dismiss"
              whileTap={press.whileTap}
              onClick={() => dismiss(t.id)}
              className={`grid size-11 place-items-center rounded-xl text-muted hover:bg-ink/5 ${FOCUS_RING}`}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
