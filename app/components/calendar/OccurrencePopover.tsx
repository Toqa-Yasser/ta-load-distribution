import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Sheet } from "~/components/ui/Sheet";
import type { Occurrence, TA, Task } from "~/engine/types";
import { fmtDateLong } from "~/lib/format";

type OccurrencePopoverProps = {
  /** False animates the sheet out; the caller keeps the occurrence until then. */
  open: boolean;
  task: Task;
  occ: Occurrence;
  tas: TA[];
  /** "view" shows every seat; "pick" asks which of the `pickable` seats a pending swap takes. */
  mode: "view" | "pick";
  /** TA ids of the seats offered in pick mode, in seat order. */
  pickable?: string[];
  /** Starts a swap from the seat held by this TA. */
  onStartSwap: (taId: string) => void;
  /** Completes the pending swap with the seat held by this TA (pick mode). */
  onPickSeat?: (taId: string) => void;
  onClose: () => void;
};

const LINK =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-field px-4 font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Sheet for one occurrence (a centred dialog). In view mode it shows who holds each seat, starts a
 * swap from any seat, or opens its task; dates change hands only by swapping, so the TAs are
 * read-only here. In pick mode it is the seat chooser for a swap onto a co-staffed date. The
 * handlers are already bound to the occurrence.
 */
export function OccurrencePopover({
  open,
  task,
  occ,
  tas,
  mode,
  pickable = [],
  onStartSwap,
  onPickSeat = () => {},
  onClose,
}: OccurrencePopoverProps) {
  const seats = mode === "pick" ? occ.seats.filter((s) => pickable.includes(s.taId)) : occ.seats;
  const onSwap = mode === "pick" ? onPickSeat : onStartSwap;
  return (
    <Sheet open={open} onClose={onClose} title={`${task.title} · ${fmtDateLong(occ.date)}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">
            {mode === "pick" ? "Swap with" : occ.seats.length === 1 ? "Assigned TA" : "Assigned TAs"}
          </span>
          <ul className="flex flex-col gap-1">
            {seats.map(({ taId }) => {
              const ta = tas.find((t) => t.id === taId);
              const name = ta?.name ?? "Unassigned";
              return (
                <li key={taId} className="flex items-center gap-2">
                  <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta?.color ?? "var(--muted)" }} />
                  <span className={`min-w-0 flex-1 truncate ${ta ? "font-medium" : "text-muted"}`}>{name}</span>
                  <Button variant="ghost" size="sm" aria-label={`Swap ${name}`} onClick={() => onSwap(taId)}>
                    {mode === "pick" ? "Swap" : "Swap…"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
        {mode === "view" && (
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/tasks/${task.id}`} className={LINK} onClick={onClose}>
              Open task
            </Link>
          </div>
        )}
      </div>
    </Sheet>
  );
}
