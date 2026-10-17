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
  onStartSwap: () => void;
  onClose: () => void;
};

const LINK =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-field px-4 font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Sheet for one occurrence (a centred dialog): shows who holds it, starts a swap, or opens its
 * task. Dates change hands only by swapping, so the TA is read-only here. The handlers are
 * already bound to the occurrence.
 */
export function OccurrencePopover({ open, task, occ, tas, onStartSwap, onClose }: OccurrencePopoverProps) {
  const owner = tas.find((t) => t.id === occ.taId);
  return (
    <Sheet open={open} onClose={onClose} title={`${task.title} · ${fmtDateLong(occ.date)}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">Assigned TA</span>
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: owner?.color ?? "var(--muted)" }} />
            <span className={owner ? "font-medium" : "text-muted"}>{owner?.name ?? "Unassigned"}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to={`/tasks/${task.id}`} className={LINK} onClick={onClose}>
            Open task
          </Link>
          <Button variant="ghost" onClick={onStartSwap}>
            Swap with…
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
