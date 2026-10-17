import { TASK_KINDS, type ISODate, type TaskKind, type Workspace } from "~/engine/types";

/** One upcoming day for a TA, with the titles of their tasks on it (task order, no repeats). */
export type NextDate = { date: ISODate; titles: string[] };

export type TAStats = {
  /** Units used this turn, per kind (from each kind's ledger). */
  used: Record<TaskKind, number>;
  /** Occurrences assigned, per task kind. */
  counts: Record<TaskKind, number>;
  totalOccurrences: number;
  nextDates: NextDate[];
};

const zeroKinds = (): Record<TaskKind, number> => ({ light: 0, heavy: 0 });

const NEXT_DATES = 3;

/** Per TA (every seat counts): per-kind used/counts, total occurrences across all tasks and the first few distinct dates on or after `today`. */
export function taStats(ws: Workspace, today: ISODate): Record<string, TAStats> {
  const totals: Record<string, number> = {};
  // TA -> upcoming date -> task titles (a Set keeps the first-seen order).
  const upcoming: Record<string, Map<ISODate, Set<string>>> = {};
  const counts: Record<string, Record<TaskKind, number>> = {};
  for (const ta of ws.tas) {
    totals[ta.id] = 0;
    upcoming[ta.id] = new Map();
    counts[ta.id] = zeroKinds();
  }
  for (const task of ws.tasks) {
    for (const o of task.occurrences) {
      for (const { taId } of o.seats) {
        if (!(taId in totals)) continue;
        totals[taId] += 1;
        counts[taId][task.kind] += 1;
        if (o.date < today) continue;
        const day = upcoming[taId].get(o.date) ?? new Set<string>();
        day.add(task.title);
        upcoming[taId].set(o.date, day);
      }
    }
  }
  const result: Record<string, TAStats> = {};
  for (const ta of ws.tas) {
    // ISO yyyy-MM-dd strings sort chronologically.
    const nextDates = [...upcoming[ta.id].keys()]
      .sort()
      .slice(0, NEXT_DATES)
      .map((date) => ({ date, titles: [...upcoming[ta.id].get(date)!] }));
    const used = zeroKinds();
    for (const kind of TASK_KINDS) used[kind] = ws.ledgers[kind].used[ta.id] ?? 0;
    result[ta.id] = { used, counts: counts[ta.id], totalOccurrences: totals[ta.id], nextDates };
  }
  return result;
}
