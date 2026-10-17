import { motion } from "motion/react";
import { KIND_LABEL, type Occurrence, type TA, type Task } from "~/engine/types";
import { fmtDate } from "~/lib/format";
import { usePressMotion } from "~/lib/motion";

/** Role of a pill while a swap is being picked; null outside swap mode. */
export type SwapRole = "source" | "target" | "ineligible" | null;

type OccurrencePillProps = {
  task: Task;
  occ: Occurrence;
  /** The TA of each seat, in seat order; undefined for a TA that no longer exists. */
  tas: (TA | undefined)[];
  selected: boolean;
  swapRole: SwapRole;
  onClick: () => void;
};

const ROLE_CLASS: Record<Exclude<SwapRole, null>, string> = {
  source: "ring-2 ring-accent-2",
  target: "animate-swap-pulse motion-reduce:animate-none",
  ineligible: "opacity-40",
};

const pct = (n: number) => `${Number(n.toFixed(2))}%`;

/** Equal hard colour stops, e.g. `c1 0% 50%, c2 50% 100%`. */
function bands(colors: string[]): string {
  return colors.map((c, i) => `${c} ${pct((i * 100) / colors.length)} ${pct(((i + 1) * 100) / colors.length)}`).join(", ");
}

/**
 * One occurrence, tinted with its TA's colour. 44px tall on touch screens; 36px on fine
 * pointers with a pseudo-element stretching the hit area to 44px (pills sit 8px apart).
 * A plain button, not a toggle: pressing it opens the popover (or picks a swap target); the swap
 * source is named in its label and the open one is ringed. A co-staffed date blends its TAs' tints
 * left to right and splits the left stripe into one equal band per seat.
 */
export function OccurrencePill({ task, occ, tas, selected, swapRole, onClick }: OccurrencePillProps) {
  const press = usePressMotion();
  const colors = tas.map((ta) => ta?.color ?? "var(--muted)");
  const owners = tas.map((ta) => ta?.name ?? "Unassigned").join(", ");
  const shared = colors.length > 1;
  const style = shared
    ? {
        background: `linear-gradient(to right, ${colors.map((c) => `color-mix(in srgb, ${c} 28%, transparent)`).join(", ")})`,
        borderColor: "transparent",
      }
    : { background: `color-mix(in srgb, ${colors[0] ?? "var(--muted)"} 22%, transparent)`, borderColor: colors[0] ?? "var(--muted)" };
  return (
    <motion.button
      type="button"
      whileHover={press.whileHover}
      whileTap={press.whileTap}
      onClick={onClick}
      aria-label={`${task.title} · ${fmtDate(occ.date)} · ${owners} · ${KIND_LABEL[task.kind]}${swapRole === "source" ? " · swapping" : ""}`}
      style={style}
      className={`relative flex min-h-9 w-full min-w-0 items-center gap-1 rounded-lg border-l-4 px-1.5 text-left text-xs font-medium text-ink transition-[filter,opacity] before:absolute before:inset-x-0 before:-inset-y-1 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent pointer-coarse:min-h-11 pointer-coarse:before:hidden ${
        selected ? "ring-2 ring-accent" : ""
      } ${swapRole ? ROLE_CLASS[swapRole] : ""}`}
    >
      {shared && (
        // Sits over the (transparent) left border, which it replaces: one hard band per seat.
        <span
          aria-hidden
          data-stripe
          className="absolute inset-y-0 -left-1 w-1 rounded-l-lg"
          style={{ background: `linear-gradient(to bottom, ${bands(colors)})` }}
        />
      )}
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
