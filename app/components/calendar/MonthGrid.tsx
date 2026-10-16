import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useMemo, useState } from "react";
import type { ISODate, OccurrenceRef, TA, Task } from "~/engine/types";
import { monthCells, occurrencesByDate } from "~/lib/calendar";
import { EASE_OUT, stepSlide, useMounted } from "~/lib/motion";
import { DayCell } from "./DayCell";

type MonthGridProps = {
  yearMonth: string;
  tasks: Task[];
  taById: Map<string, TA>;
  selected: OccurrenceRef | null;
  swapSource: OccurrenceRef | null;
  onSelect: (ref: OccurrenceRef) => void;
  /** Ringed in the grid; from the loader, never the client clock. */
  today?: ISODate;
};

const STILL = { opacity: 1, x: 0 };
const stillSlide: Variants = { enter: STILL, center: STILL, exit: STILL };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Monday-first month grid. Changing `yearMonth` slides the old month out toward the past. */
export function MonthGrid({ yearMonth, tasks, taById, selected, swapSource, onSelect, today }: MonthGridProps) {
  const reduced = useReducedMotion();
  const mounted = useMounted();
  // Direction derived during render from the previous month (1 = forward in time).
  const [prev, setPrev] = useState(yearMonth);
  const [dir, setDir] = useState(1);
  if (prev !== yearMonth) {
    setDir(yearMonth > prev ? 1 : -1);
    setPrev(yearMonth);
  }

  const byDate = useMemo(() => occurrencesByDate(tasks), [tasks]);
  const cells = useMemo(() => monthCells(yearMonth), [yearMonth]);
  const { swapTaId, swapKind } = useMemo(() => {
    if (!swapSource) return { swapTaId: null, swapKind: null };
    const task = tasks.find((t) => t.id === swapSource.taskId);
    return {
      swapTaId: task?.occurrences.find((o) => o.id === swapSource.occurrenceId)?.taId ?? null,
      swapKind: task?.kind ?? null,
    };
  }, [tasks, swapSource]);

  return (
    <div className="glass overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            <abbr title={name} className="no-underline">
              {name.slice(0, 3)}
            </abbr>
          </div>
        ))}
      </div>
      <div className="relative overflow-x-clip">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={yearMonth}
            custom={dir}
            // The variants decide the SSR style and useReducedMotion differs between server and
            // client, so the still set only takes over after mount.
            variants={reduced && mounted ? stillSlide : stepSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.25, ease: EASE_OUT }}
            className="grid grid-cols-7 *:border-b *:border-r *:nth-[7n]:border-r-0 *:nth-last-[-n+7]:border-b-0"
          >
            {cells.map((c) => (
              <DayCell
                key={c.date}
                date={c.date}
                inMonth={c.inMonth}
                isToday={c.date === today}
                entries={byDate.get(c.date) ?? []}
                taById={taById}
                selected={selected}
                swapSource={swapSource}
                swapTaId={swapTaId}
                swapKind={swapKind}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
