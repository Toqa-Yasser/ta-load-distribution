import { motion } from "motion/react";
import type { Occurrence, TA, Task } from "~/engine/types";
import { fmtDate } from "~/lib/format";
import { usePressMotion } from "~/lib/motion";
import { KIND_LABEL } from "~/components/tasks/KindBadge";

/** Role of a pill while a swap is being picked; null outside swap mode. */
export type SwapRole = "source" | "target" | "ineligible" | null;

type OccurrencePillProps = {
  task: Task;
  occ: Occurrence;
  ta: TA | undefined;
  selected: boolean;
  swapRole: SwapRole;
  onClick: () => void;
};

const ROLE_CLASS: Record<Exclude<SwapRole, null>, string> = {
  source: "ring-2 ring-accent-2",
  target: "animate-swap-pulse motion-reduce:animate-none",
  ineligible: "opacity-40",
};

/**
 * One occurrence, tinted with its TA's colour. 44px tall on touch screens; 36px on fine
 * pointers with a pseudo-element stretching the hit area to 44px (pills sit 8px apart).
 */
export function OccurrencePill({ task, occ, ta, selected, swapRole, onClick }: OccurrencePillProps) {
  const press = usePressMotion();
  const color = ta?.color ?? "var(--muted)";
  const owner = ta?.name ?? "Unassigned";
  return (
    <motion.button
      type="button"
      whileHover={press.whileHover}
      whileTap={press.whileTap}
      onClick={onClick}
      aria-label={`${task.title} · ${fmtDate(occ.date)} · ${owner} · ${KIND_LABEL[task.kind]}${swapRole === "source" ? " · swapping" : ""}`}
      aria-pressed={selected || swapRole === "source"}
      style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, borderColor: color }}
      className={`relative flex min-h-9 w-full min-w-0 items-center gap-1 rounded-lg border-l-4 px-1.5 text-left text-xs font-medium text-ink transition-[filter,opacity] before:absolute before:inset-x-0 before:-inset-y-1 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent pointer-coarse:min-h-11 pointer-coarse:before:hidden ${
        selected ? "ring-2 ring-accent" : ""
      } ${swapRole ? ROLE_CLASS[swapRole] : ""}`}
    >
      {/* Kind marker; the kind is spelled out in the accessible name. */}
      <span
        aria-hidden
        data-kind={task.kind}
        className={`size-1.5 shrink-0 rounded-full ${task.kind === "heavy" ? "bg-heavy" : "bg-light"}`}
      />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {swapRole === "source" && (
        <span
          aria-hidden
          className="hidden shrink-0 rounded bg-danger px-1 text-[10px] font-semibold uppercase leading-4 text-white sm:inline"
        >
          swap
        </span>
      )}
    </motion.button>
  );
}
