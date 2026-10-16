import { useState } from "react";
import type { ISODate, OccurrenceRef, TA, TaskKind } from "~/engine/types";
import type { DayEntry } from "~/lib/calendar";
import { fmtDate } from "~/lib/format";
import { OccurrencePill, type SwapRole } from "./OccurrencePill";

type DayCellProps = {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  entries: DayEntry[];
  taById: Map<string, TA>;
  selected: OccurrenceRef | null;
  swapSource: OccurrenceRef | null;
  /** TA of the swap source; pills with the same TA cannot be swapped with it. */
  swapTaId: string | null;
  /** Kind of the swap source; only tasks of the same kind can be swapped with it. */
  swapKind: TaskKind | null;
  onSelect: (ref: OccurrenceRef) => void;
};

const MOBILE_MAX = 2;
const DESKTOP_MAX = 4;

// CSS-only overflow: pills past the limit are display:none at that breakpoint.
function visibility(i: number): string {
  if (i < MOBILE_MAX) return "";
  if (i < DESKTOP_MAX) return "hidden md:block";
  return "hidden";
}

const MORE =
  "min-h-11 w-full rounded-lg px-1.5 text-left text-xs font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";

const same = (a: OccurrenceRef | null, b: OccurrenceRef) =>
  a !== null && a.taskId === b.taskId && a.occurrenceId === b.occurrenceId;

export function DayCell({ date, inMonth, isToday, entries, taById, selected, swapSource, swapTaId, swapKind, onSelect }: DayCellProps) {
  const [expanded, setExpanded] = useState(false);
  const day = Number(date.slice(8));
  const hiddenMobile = entries.length - MOBILE_MAX;
  const hiddenDesktop = entries.length - DESKTOP_MAX;

  const roleOf = (ref: OccurrenceRef, taId: string, kind: TaskKind): SwapRole => {
    if (!swapSource) return null;
    if (same(swapSource, ref)) return "source";
    return taId === swapTaId || kind !== swapKind ? "ineligible" : "target";
  };

  return (
    <div
      className={`flex min-h-24 min-w-0 flex-col gap-1 border-line p-1 md:min-h-32 md:p-1.5 ${inMonth ? "" : "bg-ink/[0.03] text-muted"}`}
    >
      <span
        aria-current={isToday ? "date" : undefined}
        className={`grid size-6 place-items-center self-end rounded-full text-xs font-semibold tabular-nums md:self-start ${
          isToday ? "bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
        } ${inMonth ? "" : "opacity-60"}`}
      >
        <span className="sr-only">{fmtDate(date)}</span>
        <span aria-hidden>{day}</span>
      </span>
      <ul className={`flex flex-col gap-2 ${inMonth ? "" : "opacity-70"}`}>
        {entries.map(({ task, occ }, i) => {
          const ref = { taskId: task.id, occurrenceId: occ.id };
          return (
            <li key={`${task.id}:${occ.id}`} className={expanded ? "" : visibility(i)}>
              <OccurrencePill
                task={task}
                occ={occ}
                ta={taById.get(occ.taId)}
                selected={same(selected, ref)}
                swapRole={roleOf(ref, occ.taId, task.kind)}
                onClick={() => onSelect(ref)}
              />
            </li>
          );
        })}
      </ul>
      {expanded ? (
        <button type="button" className={MORE} onClick={() => setExpanded(false)}>
          Less
        </button>
      ) : (
        <>
          {hiddenMobile > 0 && (
            <button
              type="button"
              aria-label={`Show ${hiddenMobile} more on ${fmtDate(date)}`}
              className={`${MORE} md:hidden`}
              onClick={() => setExpanded(true)}
            >
              +{hiddenMobile}
            </button>
          )}
          {hiddenDesktop > 0 && (
            <button
              type="button"
              aria-label={`Show ${hiddenDesktop} more on ${fmtDate(date)}`}
              className={`${MORE} hidden md:block`}
              onClick={() => setExpanded(true)}
            >
              +{hiddenDesktop}
            </button>
          )}
        </>
      )}
    </div>
  );
}
