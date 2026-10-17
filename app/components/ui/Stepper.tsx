import { motion } from "motion/react";
import { useId, useRef } from "react";
import { usePressMotion } from "~/lib/motion";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** id of a hint that explains the choice. */
  describedBy?: string;
};

const BUTTON_CLASS =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-field text-lg font-medium text-ink transition-colors hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent";

/**
 * Number stepper: a visible label (styled like a Field label) over minus and plus buttons around
 * a keyboard-operable spinbutton value. The label names both the group and the spinbutton.
 */
export function Stepper({ label, value, min, max, onChange, describedBy }: StepperProps) {
  const press = usePressMotion();
  const labelId = useId();
  const spinRef = useRef<HTMLSpanElement>(null);
  const set = (n: number) => {
    const next = Math.min(max, Math.max(min, n));
    if (next !== value) onChange(next);
  };
  // A button that hits the bound becomes disabled and would drop focus to <body>; hand it to the value.
  const step = (n: number) => {
    set(n);
    if (n <= min || n >= max) spinRef.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = { ArrowUp: value + 1, ArrowDown: value - 1, Home: min, End: max }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    set(target);
  };
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="inline-flex items-center gap-1 self-start rounded-field border border-line bg-ink/[0.03] p-1"
      >
        <motion.button type="button" aria-label="Decrease" disabled={value <= min} {...press} onClick={() => step(value - 1)} className={BUTTON_CLASS}>
          <span aria-hidden>−</span>
        </motion.button>
        <span
          ref={spinRef}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          onKeyDown={onKeyDown}
          className="min-w-8 rounded-field text-center text-base font-medium tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {value}
        </span>
        <motion.button type="button" aria-label="Increase" disabled={value >= max} {...press} onClick={() => step(value + 1)} className={BUTTON_CLASS}>
          <span aria-hidden>+</span>
        </motion.button>
      </div>
    </div>
  );
}
