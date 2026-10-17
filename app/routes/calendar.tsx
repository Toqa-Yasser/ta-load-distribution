import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/calendar";
import { MonthGrid } from "~/components/calendar/MonthGrid";
import { OccurrencePopover } from "~/components/calendar/OccurrencePopover";
import { Button } from "~/components/ui/Button";
import { IconButton } from "~/components/ui/IconButton";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "~/components/ui/icons";
import { EmptyState } from "~/components/ui/EmptyState";
import type { OccurrenceRef, SeatRef, Workspace } from "~/engine/types";
import { fmtMonth, shiftMonth } from "~/lib/calendar";
import { stagger } from "~/lib/motion";
import { routeMeta } from "~/lib/seo";
import { useRetained } from "~/lib/retain";
import { swappableSeats } from "~/lib/swap";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta(matches, { title: "Calendar", description: "Month view of every assigned occurrence.", path: "/calendar" });
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function lookup(workspace: Workspace, ref: OccurrenceRef) {
  const task = workspace.tasks.find((t) => t.id === ref.taskId);
  const occ = task?.occurrences.find((o) => o.id === ref.occurrenceId);
  return task && occ ? { task, occ } : null;
}

export default function Calendar() {
  const { workspace, today, taById } = useWorkspace();
  const { submit } = useCommand();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const m = params.get("m");
  const yearMonth = m && MONTH.test(m) ? m : today.slice(0, 7);
  // The ref stays set after closing so the sheet can animate out with its content.
  // "pick" is the seat chooser for a swap onto a co-staffed date; `pickable` lists its valid seats.
  const [popover, setPopover] = useState<{ ref: OccurrenceRef; open: boolean; mode: "view" | "pick" } | null>(null);
  const [pickable, setPickable] = useState<string[]>([]);
  const [swapSource, setSwapSource] = useState<SeatRef | null>(null);

  const goTo = (month: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set("m", month);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const swapWith = (b: SeatRef) => {
    if (!swapSource) return;
    submit({ type: "swapOccurrences", a: swapSource, b });
    setSwapSource(null);
  };

  const onSelect = (ref: OccurrenceRef) => {
    if (!swapSource) {
      setPopover({ ref, open: true, mode: "view" });
      return;
    }
    const a = lookup(workspace, swapSource);
    const b = lookup(workspace, ref);
    // Pills with no seat to trade (same occurrence, other kind, the source TA already on it) are
    // dimmed and would change nothing or be refused, so send nothing.
    const valid = a && b ? swappableSeats({ ...a, taId: swapSource.taId }, b) : [];
    if (valid.length === 0) return;
    if (valid.length === 1) {
      swapWith({ ...ref, taId: valid[0] });
      return;
    }
    setPickable(valid);
    setPopover({ ref, open: true, mode: "pick" });
  };

  // Memoised: useRetained needs a stable reference. If the occurrence disappears while the
  // popover is open (deleted elsewhere, undone), it closes showing what it was opened for.
  const current = useMemo(() => (popover ? lookup(workspace, popover.ref) : null), [workspace, popover]);
  const shown = useRetained(current);
  // Closed for good (adjusted during render), so it can't spring back open if an undo restores it.
  if (popover?.open && current === null) setPopover({ ...popover, open: false });
  const swapping = swapSource ? lookup(workspace, swapSource) : null;
  // The swap source vanished (deleted elsewhere, undone): leave swap mode rather than dim everything.
  if (swapSource && swapping === null) setSwapSource(null);
  const closePopover = () => setPopover((p) => p && { ...p, open: false });

  return (
    <div className="flex flex-col gap-6">
      <header {...stagger(0, "rise", "flex flex-wrap items-center justify-between gap-3")}>
        <div>
          <h1 className="text-display font-semibold">Calendar</h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {fmtMonth(yearMonth)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton aria-label="Previous month" onClick={() => goTo(shiftMonth(yearMonth, -1))}>
            <ChevronLeftIcon />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => goTo(today.slice(0, 7))}>
            Today
          </Button>
          <IconButton aria-label="Next month" onClick={() => goTo(shiftMonth(yearMonth, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </div>
      </header>

      {workspace.tas.length > 0 && (
        <ul aria-label="TAs" {...stagger(1, "rise", "flex flex-wrap gap-x-4 gap-y-1 text-sm")}>
          {workspace.tas.map((ta) => (
            <li key={ta.id} className="flex items-center gap-2">
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

      {workspace.tasks.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title="Nothing scheduled yet"
          body="Create a task and its dates show up here, coloured by TA."
          action={{ label: "New task", onClick: () => navigate("/tasks?new=1") }}
        />
      ) : (
        <div {...stagger(2)}>
        <MonthGrid
          yearMonth={yearMonth}
          tasks={workspace.tasks}
          taById={taById}
          today={today}
          selected={popover?.open ? popover.ref : null}
          swapSource={swapSource}
          onSelect={onSelect}
        />
        </div>
      )}

      {popover && shown && (
        <OccurrencePopover
          open={popover.open}
          task={shown.task}
          occ={shown.occ}
          tas={workspace.tas}
          mode={popover.mode}
          pickable={pickable}
          onClose={closePopover}
          onStartSwap={(taId) => {
            setSwapSource({ ...popover.ref, taId });
            closePopover();
          }}
          onPickSeat={(taId) => {
            swapWith({ ...popover.ref, taId });
            closePopover();
          }}
        />
      )}
    </div>
  );
}

