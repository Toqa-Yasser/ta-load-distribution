import { motion, useReducedMotion } from "motion/react";
import type { Occurrence, TA } from "~/engine/types";
import { EASE_OUT } from "~/lib/motion";

type SplitBarProps = {
  occurrences: Occurrence[];
  tas: TA[];
  /** Also list each TA's count under the bar. */
  legend?: boolean;
};

/**
 * Horizontal stacked bar: one segment per TA, width proportional to how many of the task's
 * occurrences they hold. Widths animate on change; `initial={false}` renders the final width
 * on the server and on hydration. Width is not a transform, so MotionConfig does not cover it:
 * under prefers-reduced-motion the width is applied directly as a style, with no tween.
 */
export function SplitBar({ occurrences, tas, legend = false }: SplitBarProps) {
  const reduced = useReducedMotion();
  const counts = new Map<string, number>();
  for (const o of occurrences) counts.set(o.taId, (counts.get(o.taId) ?? 0) + 1);
  const total = occurrences.length;
  const parts = tas.filter((ta) => (counts.get(ta.id) ?? 0) > 0).map((ta) => ({ ta, n: counts.get(ta.id)! }));
  const summary = parts.map(({ ta, n }) => `${ta.name} ${n}`).join(", ");

  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={total === 0 ? "No occurrences" : `Split: ${summary}`}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-ink/5"
      >
        {parts.map(({ ta, n }) => {
          const width = `${(n / total) * 100}%`;
          return (
            <motion.div
              key={ta.id}
              title={`${ta.name}: ${n}`}
              initial={false}
              // Reduced motion: the width is set in the same render (even a 0s tween lands a frame later).
              animate={reduced ? undefined : { width }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ background: ta.color, ...(reduced ? { width } : {}) }}
            />
          );
        })}
      </div>
      {legend && parts.length > 0 && (
        <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {parts.map(({ ta, n }) => (
            <li key={ta.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: ta.color }} />
              {ta.name}
              <span className="font-semibold tabular-nums text-ink">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
