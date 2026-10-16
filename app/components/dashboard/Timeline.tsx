import { addDays, format, parseISO } from "date-fns";
import { motion, useReducedMotion } from "motion/react";
import type { ISODate, TA, Task } from "~/engine/types";
import { EASE_OUT } from "~/lib/motion";
import { fmtDate } from "~/lib/format";

type TimelineProps = { tasks: Task[]; taById: Map<string, TA>; today: ISODate; days?: number };
type Row = { key: string; title: string; ta: TA | undefined };

const STAGGER = 0.05;
const MAX_DELAY = 0.4;

const shift = (iso: ISODate, n: number): ISODate => format(addDays(parseISO(iso), n), "yyyy-MM-dd");

/** Occurrences from `today` up to (not including) `today + days`, grouped by date on a vertical line. */
export function Timeline({ tasks, taById, today, days = 14 }: TimelineProps) {
  const reduced = useReducedMotion();
  const end = shift(today, days);
  const tomorrow = shift(today, 1);

  const byDate = new Map<ISODate, Row[]>();
  for (const task of tasks) {
    for (const o of task.occurrences) {
      // ISO yyyy-MM-dd strings compare chronologically.
      if (o.date < today || o.date >= end) continue;
      const rows = byDate.get(o.date) ?? [];
      rows.push({ key: `${task.id}:${o.id}`, title: task.title, ta: taById.get(o.taId) });
      byDate.set(o.date, rows);
    }
  }
  const groups = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <section aria-labelledby="timeline-title" className="glass flex flex-col gap-4 p-4">
      <h2 id="timeline-title" className="text-lg font-semibold">
        Coming up
      </h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">Nothing in the next {days} days</p>
      ) : (
        <ol className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:rounded-full before:bg-ink/10">
          {groups.map(([date, rows], i) => (
            <motion.li
              key={date}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE_OUT, delay: Math.min(i * STAGGER, MAX_DELAY) }}
              className="relative pl-7"
            >
              <span aria-hidden className="absolute left-0 top-1.5 size-3 rounded-full border-2 border-accent bg-bg" />
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{fmtDate(date)}</span>
                {(date === today || date === tomorrow) && (
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">
                    {date === today ? "Today" : "Tomorrow"}
                  </span>
                )}
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {rows.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    {r.ta && (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink/5 px-2 py-0.5 text-xs font-medium">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: r.ta.color }} />
                        {r.ta.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}
