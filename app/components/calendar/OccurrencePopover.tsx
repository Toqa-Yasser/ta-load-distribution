import { useId } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Select } from "~/components/ui/Select";
import { Sheet } from "~/components/ui/Sheet";
import type { Occurrence, TA, Task } from "~/engine/types";
import { fmtDateLong } from "~/lib/format";

type OccurrencePopoverProps = {
  /** False animates the sheet out; the caller keeps the occurrence until then. */
  open: boolean;
  task: Task;
  occ: Occurrence;
  tas: TA[];
  onReassign: (taId: string) => void;
  onStartSwap: () => void;
  onClose: () => void;
};

const LINK =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Sheet for one occurrence (bottom sheet on mobile, dialog on desktop): reassign it to
 * another TA, start a swap, or open its task. The handlers are already bound to the occurrence.
 */
export function OccurrencePopover({ open, task, occ, tas, onReassign, onStartSwap, onClose }: OccurrencePopoverProps) {
  const selectId = useId();
  const owner = tas.find((t) => t.id === occ.taId);
  return (
    <Sheet open={open} onClose={onClose} title={`${task.title} · ${fmtDateLong(occ.date)}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            Assigned TA
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: owner?.color ?? "var(--muted)" }} />
            <Select
              id={selectId}
              data-autofocus
              className="flex-1"
              value={occ.taId}
              onChange={(e) => {
                // Re-picking the current TA is a no-op; send nothing.
                if (e.target.value !== occ.taId) onReassign(e.target.value);
              }}
            >
              {!owner && <option value={occ.taId}>Unassigned</option>}
              {tas.map((ta) => (
                <option key={ta.id} value={ta.id}>
                  {ta.name}
                </option>
              ))}
            </Select>
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
