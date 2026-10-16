import { motion, useReducedMotion } from "motion/react";
import { indicatorSpring, usePressMotion } from "~/lib/motion";

/** Radio-group segmented control; the active segment's pill glides between options via `layoutId`. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  label,
  className,
  describedBy,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  label: string;
  className: string;
  /** id of a hint that explains the choice. */
  describedBy?: string;
}) {
  const reduced = useReducedMotion();
  const press = usePressMotion();
  return (
    <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className={`grid gap-1 rounded-2xl border border-line bg-ink/[0.03] p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            {...press}
            onClick={() => onChange(o.value)}
            className={`relative isolate min-h-11 rounded-xl px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={reduced ? { duration: 0 } : indicatorSpring}
                className="absolute inset-0 -z-10 rounded-xl border border-line bg-surface shadow-sm"
              />
            )}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}
