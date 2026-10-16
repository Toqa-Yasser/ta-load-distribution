import { useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/calendar";
import { MonthGrid } from "~/components/calendar/MonthGrid";
import { OccurrencePopover } from "~/components/calendar/OccurrencePopover";
import { Button } from "~/components/ui/Button";
import type { OccurrenceRef, Workspace } from "~/engine/types";
import { fmtMonth, shiftMonth } from "~/lib/calendar";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Calendar · TA Load Distribution" }];
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const sameRef = (a: OccurrenceRef, b: OccurrenceRef) => a.taskId === b.taskId && a.occurrenceId === b.occurrenceId;

function lookup(workspace: Workspace, ref: OccurrenceRef) {
  const task = workspace.tasks.find((t) => t.id === ref.taskId);
  const occ = task?.occurrences.find((o) => o.id === ref.occurrenceId);
  return task && occ ? { task, occ } : null;
}

export default function Calendar() {
  const { workspace, today, taById } = useWorkspace();
  const { submit } = useCommand();
  const [params, setParams] = useSearchParams();
  const m = params.get("m");
  const yearMonth = m && MONTH.test(m) ? m : today.slice(0, 7);
  // The ref stays set after closing so the sheet can animate out with its content.
  const [popover, setPopover] = useState<{ ref: OccurrenceRef; open: boolean } | null>(null);
  const [swapSource, setSwapSource] = useState<OccurrenceRef | null>(null);

  const goTo = (month: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set("m", month);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const onSelect = (ref: OccurrenceRef) => {
    if (!swapSource) {
      setPopover({ ref, open: true });
      return;
    }
    const a = lookup(workspace, swapSource);
    const b = lookup(workspace, ref);
    // Same occurrence or same TA: nothing would change, so send nothing. Other-kind pills are
    // dimmed and the engine refuses cross-kind swaps, so ignore those too.
    if (sameRef(swapSource, ref) || !a || !b || a.occ.taId === b.occ.taId || a.task.kind !== b.task.kind) return;
    submit({ type: "swapOccurrences", a: swapSource, b: ref });
    setSwapSource(null);
  };

  const current = popover && lookup(workspace, popover.ref);
  const swapping = swapSource && lookup(workspace, swapSource);
  const closePopover = () => setPopover((p) => p && { ...p, open: false });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">Calendar</h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {fmtMonth(yearMonth)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" icon aria-label="Previous month" onClick={() => goTo(shiftMonth(yearMonth, -1))}>
            <Chevron d="M15 6l-6 6 6 6" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => goTo(today.slice(0, 7))}>
            Today
          </Button>
          <Button variant="ghost" icon aria-label="Next month" onClick={() => goTo(shiftMonth(yearMonth, 1))}>
            <Chevron d="M9 6l6 6-6 6" />
          </Button>
        </div>
      </header>

      {workspace.tas.length > 0 && (
        <ul aria-label="TAs" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {workspace.tas.map((ta) => (
            <li key={ta.id} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: ta.color }} />
              {ta.name}
            </li>
          ))}
        </ul>
      )}

      {swapSource && (
        <div role="status" className="glass flex items-center justify-between gap-3 py-1 pl-4 pr-1 text-sm">
          <span>{swapping ? `Pick another ${swapping.task.kind} occurrence to swap with` : "Pick an occurrence to swap with"}</span>
          <Button variant="ghost" size="sm" onClick={() => setSwapSource(null)}>
            Cancel
          </Button>
        </div>
      )}

      <MonthGrid
        yearMonth={yearMonth}
        tasks={workspace.tasks}
        taById={taById}
        today={today}
        selected={popover?.open ? popover.ref : null}
        swapSource={swapSource}
        onSelect={onSelect}
      />

      {popover && current && (
        <OccurrencePopover
          open={popover.open}
          ref={popover.ref}
          task={current.task}
          occ={current.occ}
          tas={workspace.tas}
          onClose={closePopover}
          onReassign={(taId) => {
            submit({ type: "reassignOccurrence", ref: popover.ref, taId });
            closePopover();
          }}
          onStartSwap={() => {
            setSwapSource(popover.ref);
            closePopover();
          }}
        />
      )}
    </div>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
