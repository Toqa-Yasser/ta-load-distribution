import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastInput = {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
};

export type ToastItem = ToastInput & { id: number };
/** Why a toast's auto-dismiss clock is paused: the pointer is over it, or focus is inside it. */
export type ToastHold = "hover" | "focus";
/** Auto-dismiss clock; paused while any hold is active. */
type Timer = { handle?: ReturnType<typeof setTimeout>; deadline: number; remaining: number; holds: Set<ToastHold> };

const TOAST_MS = 6000;
const MAX_TOASTS = 3;

type ToastQueue = {
  items: ToastItem[];
  dismiss(id: number): void;
  hold(id: number, why: ToastHold): void;
  release(id: number, why: ToastHold): void;
};

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);
const ToastQueueContext = createContext<ToastQueue | null>(null);

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

/** The live toasts and their controls, for the visual stack (components/ui/Toast's <Toaster>). */
export function useToastQueue(): ToastQueue {
  const ctx = useContext(ToastQueueContext);
  if (!ctx) throw new Error("useToastQueue must be used inside <ToastProvider>.");
  return ctx;
}

/** Owns the toast queue and its timers; renders no markup itself. Mount <Toaster> inside it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, Timer>());
  // Ids on screen, oldest first; mirrors `items` so a dropped toast's timer can be cleared.
  const order = useRef<number[]>([]);

  const clearTimer = useCallback((id: number) => {
    clearTimeout(timers.current.get(id)?.handle);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      order.current = order.current.filter((x) => x !== id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    },
    [clearTimer],
  );

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
      // Keep the stack short: newest three. Dropped toasts take their timers with them.
      order.current = [...order.current, id];
      while (order.current.length > MAX_TOASTS) clearTimer(order.current.shift()!);
      setItems((xs) => [...xs.slice(1 - MAX_TOASTS), { ...t, id }]);
      const timer: Timer = { deadline: 0, remaining: TOAST_MS, holds: new Set() };
      timers.current.set(id, timer);
      run(id, timer);
    },
    [run, clearTimer],
  );

  // WCAG 2.2.1: the countdown (and with it the Undo) waits while the toast is hovered or focused.
  const hold = useCallback((id: number, why: ToastHold) => {
    const timer = timers.current.get(id);
    if (!timer || timer.holds.has(why)) return;
    if (timer.holds.size === 0) {
      clearTimeout(timer.handle);
      timer.remaining = Math.max(0, timer.deadline - Date.now());
    }
    timer.holds.add(why);
  }, []);
  const release = useCallback(
    (id: number, why: ToastHold) => {
      const timer = timers.current.get(id);
      if (!timer || !timer.holds.delete(why)) return;
      if (timer.holds.size === 0) run(id, timer);
    },
    [run],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t.handle));
  }, []);

  const queue = useMemo(() => ({ items, dismiss, hold, release }), [items, dismiss, hold, release]);

  return (
    <ToastContext.Provider value={push}>
      <ToastQueueContext.Provider value={queue}>{children}</ToastQueueContext.Provider>
    </ToastContext.Provider>
  );
}
