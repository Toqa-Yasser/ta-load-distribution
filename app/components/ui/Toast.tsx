import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE_OUT, hoverLift, tapPress } from "~/lib/motion";

export type ToastInput = {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastInput & { id: number };

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
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      // Keep the stack short: newest three.
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => push, [push]);
  const reduced = useReducedMotion();

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
                  whileHover={hoverLift}
                  whileTap={tapPress}
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
                whileTap={tapPress}
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
