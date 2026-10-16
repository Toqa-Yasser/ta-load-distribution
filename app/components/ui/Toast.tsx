import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE_OUT, usePressMotion } from "~/lib/motion";

export type ToastInput = {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastInput & { id: number };
/** Auto-dismiss clock; paused while any hold (pointer over it, focus inside) is active. */
type Timer = { handle?: ReturnType<typeof setTimeout>; deadline: number; remaining: number; holds: Set<Hold> };
type Hold = "hover" | "focus";

const TOAST_MS = 6000;

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, Timer>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id)?.handle);
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const run = useCallback(
    (id: number, timer: Timer) => {
      timer.deadline = Date.now() + timer.remaining;
      timer.handle = setTimeout(() => dismiss(id), timer.remaining);
    },
    [dismiss],
  );

  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      // Keep the stack short: newest three.
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      const timer: Timer = { deadline: 0, remaining: TOAST_MS, holds: new Set() };
      timers.current.set(id, timer);
      run(id, timer);
    },
    [run],
  );

  // WCAG 2.2.1: the countdown (and with it the Undo) waits while the toast is hovered or focused.
  const hold = (id: number, why: Hold) => {
    const timer = timers.current.get(id);
    if (!timer || timer.holds.has(why)) return;
    if (timer.holds.size === 0) {
      clearTimeout(timer.handle);
      timer.remaining = Math.max(0, timer.deadline - Date.now());
    }
    timer.holds.add(why);
  };
  const release = (id: number, why: Hold) => {
    const timer = timers.current.get(id);
    if (!timer || !timer.holds.delete(why)) return;
    if (timer.holds.size === 0) run(id, timer);
  };

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t.handle));
  }, []);

  const value = useMemo(() => push, [push]);
  const reduced = useReducedMotion();
  const press = usePressMotion();

  return (
    <ToastContext.Provider value={value}>
      {children}
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
                  className="min-h-11 rounded-xl px-3 font-semibold text-accent hover:bg-accent/10"
                >
                  {t.action.label}
                </motion.button>
              )}
              <motion.button
                type="button"
                aria-label="Dismiss"
                whileTap={press.whileTap}
                onClick={() => dismiss(t.id)}
                className="grid size-11 place-items-center rounded-xl text-muted hover:bg-ink/5"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
