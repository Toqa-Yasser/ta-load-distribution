import { addDays, format, parseISO } from "date-fns";
import { KindBadge } from "~/components/tasks/KindBadge";
import { Badge } from "~/components/ui/Badge";
import type { ISODate, TA, Task, TaskKind } from "~/engine/types";
import { fmtDate } from "~/lib/format";

type TimelineProps = { tasks: Task[]; taById: Map<string, TA>; today: ISODate; days?: number };
type Row = { key: string; title: string; kind: TaskKind; tas: TA[] };

const shift = (iso: ISODate, n: number): ISODate => format(addDays(parseISO(iso), n), "yyyy-MM-dd");

/** Occurrences from `today` up to (not including) `today + days`, grouped by date on a vertical line. */
export function Timeline({ tasks, taById, today, days = 14 }: TimelineProps) {
  const end = shift(today, days);
  const tomorrow = shift(today, 1);

  const byDate = new Map<ISODate, Row[]>();
  for (const task of tasks) {
    for (const o of task.occurrences) {
      // ISO yyyy-MM-dd strings compare chronologically.
      if (o.date < today || o.date >= end) continue;
      const rows = byDate.get(o.date) ?? [];
      rows.push({ key: `${task.id}:${o.id}`, title: task.title, kind: task.kind, tas: o.seats.flatMap((s) => taById.get(s.taId) ?? []) });
      byDate.set(o.date, rows);
    }
  }
  const groups = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <section aria-labelledby="timeline-title" className="glass flex flex-col gap-4 p-5">
      <h2 id="timeline-title" className="text-heading font-semibold">
        Coming up
      </h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">Nothing in the next {days} days</p>
      ) : (
        <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:rounded-full before:bg-ink/10">
          {groups.map(([date, rows]) => (
            <li key={date} className="relative pl-7">
              <span aria-hidden className="absolute left-0 top-1.5 size-3 rounded-full border-2 border-accent bg-bg" />
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{fmtDate(date)}</span>
                {(date === today || date === tomorrow) && (
                  <Badge tone="accent" size="sm">
                    {date === today ? "Today" : "Tomorrow"}
                  </Badge>
                )}
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {rows.map((r) => (
                  // The TA chip follows the kind badge, so on wide screens it stays next to the task name.
                  <li key={r.key} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 truncate">{r.title}</span>
                    <KindBadge kind={r.kind} size="sm" />
                    {r.tas.map((ta) => (
                      <Badge key={ta.id} tone="plain" size="sm">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: ta.color }} />
                        {ta.name}
                      </Badge>
                    ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
