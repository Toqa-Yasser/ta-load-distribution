import { motion } from "motion/react";
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

/** Number stepper: minus and plus buttons around a keyboard-operable spinbutton value. */
export function Stepper({ label, value, min, max, onChange, describedBy }: StepperProps) {
  const press = usePressMotion();
  const set = (n: number) => {
    const next = Math.min(max, Math.max(min, n));
    if (next !== value) onChange(next);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = { ArrowUp: value + 1, ArrowDown: value - 1, Home: min, End: max }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    set(target);
  };
  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className="inline-flex items-center gap-1 self-start rounded-field border border-line bg-ink/[0.03] p-1"
    >
      <motion.button type="button" aria-label="Decrease" disabled={value <= min} {...press} onClick={() => set(value - 1)} className={BUTTON_CLASS}>
        <span aria-hidden>−</span>
      </motion.button>
      <span
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={onKeyDown}
        className="min-w-8 rounded-field text-center text-base font-medium tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {value}
      </span>
      <motion.button type="button" aria-label="Increase" disabled={value >= max} {...press} onClick={() => set(value + 1)} className={BUTTON_CLASS}>
        <span aria-hidden>+</span>
      </motion.button>
    </div>
  );
}
