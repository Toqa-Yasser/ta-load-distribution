import { motion, useReducedMotion } from "motion/react";
import { KindBadge } from "~/components/tasks/KindBadge";
import { CountUp } from "~/components/ui/CountUp";
import { KIND_LABEL, type TaskKind } from "~/engine/types";
import { EASE_OUT, useMounted } from "~/lib/motion";

type TurnHeaderProps = { kind: TaskKind; turn: number; usedUnits: number; turnSize: number; className?: string };

/**
 * Stat tile for one kind's current turn: the kind and turn number, a big "used/turnSize" numeral
 * and a full-width progress strip. The strip's width is not a transform, so MotionConfig does not
 * cover it: under prefers-reduced-motion (once mounted) it is set directly as a style instead of
 * tweened, like SplitBar.
 */
export function TurnHeader({ kind, turn, usedUnits, turnSize, className = "" }: TurnHeaderProps) {
  const reducedMotion = useReducedMotion();
  const reduced = useMounted() && reducedMotion;

  if (turnSize === 0) return <p className="text-muted">No sections yet</p>;

  const width = `${Math.min(1, Math.max(0, usedUnits / turnSize)) * 100}%`;
  const strip = `h-full rounded-full ${kind === "light" ? "bg-light" : "bg-heavy"}`;
  return (
    <div role="group" aria-label={`${KIND_LABEL[kind]} turn`} className={`glass flex min-w-0 flex-col gap-3 p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <KindBadge kind={kind} />
        <span className="text-sm text-muted">Turn {turn}</span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span data-testid="turn-numeral" className="font-display text-display font-semibold tabular-nums">
          <CountUp value={usedUnits} />/{turnSize}
        </span>
        <span className="text-sm text-muted">{usedUnits === 1 ? "unit used" : "units used"}</span>
      </p>
      <div data-testid="turn-strip" aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
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
