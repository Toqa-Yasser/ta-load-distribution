import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, useMounted } from "~/lib/motion";

type TurnHeaderProps = { turn: number; usedUnits: number; turnSize: number };

/**
 * "Turn 2 · 5/8 units used" with a thin progress strip. The strip's width is not a transform,
 * so MotionConfig does not cover it: under prefers-reduced-motion (once mounted) it is set
 * directly as a style instead of tweened, like SplitBar.
 */
export function TurnHeader({ turn, usedUnits, turnSize }: TurnHeaderProps) {
  const reducedMotion = useReducedMotion();
  const reduced = useMounted() && reducedMotion;

  if (turnSize === 0) return <p className="text-muted">No sections yet</p>;

  const width = `${Math.min(1, Math.max(0, usedUnits / turnSize)) * 100}%`;
  const strip = "h-full rounded-full bg-accent";
  return (
    <div className="flex max-w-md flex-col gap-2">
      <p className="text-muted">
        Turn {turn} · {usedUnits}/{turnSize} units used
      </p>
      <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        {reduced ? (
          <div className={strip} style={{ width }} />
        ) : (
          <motion.div
            className={strip}
            initial={{ width: "0%" }}
            animate={{ width }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        )}
      </div>
    </div>
  );
}
