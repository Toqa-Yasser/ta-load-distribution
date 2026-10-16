import { TASK_KINDS, type ISODate, type TaskKind, type Workspace } from "~/engine/types";

export type TAStats = {
  /** Units used this turn, per kind (from each kind's ledger). */
  used: Record<TaskKind, number>;
  /** Occurrences assigned, per task kind. */
  counts: Record<TaskKind, number>;
  totalOccurrences: number;
  nextDates: ISODate[];
};

const zeroKinds = (): Record<TaskKind, number> => ({ light: 0, heavy: 0 });

const NEXT_DATES = 3;

/** Per TA: per-kind used/counts, total occurrences across all tasks and the first few distinct dates on or after `today`. */
export function taStats(ws: Workspace, today: ISODate): Record<string, TAStats> {
  const totals: Record<string, number> = {};
  const upcoming: Record<string, Set<ISODate>> = {};
  const counts: Record<string, Record<TaskKind, number>> = {};
  for (const ta of ws.tas) {
    totals[ta.id] = 0;
    upcoming[ta.id] = new Set();
    counts[ta.id] = zeroKinds();
  }
  for (const task of ws.tasks) {
    for (const o of task.occurrences) {
      if (!(o.taId in totals)) continue;
      totals[o.taId] += 1;
      counts[o.taId][task.kind] += 1;
      if (o.date >= today) upcoming[o.taId].add(o.date);
    }
  }
  const result: Record<string, TAStats> = {};
  for (const ta of ws.tas) {
    // ISO yyyy-MM-dd strings sort chronologically.
    const nextDates = [...upcoming[ta.id]].sort().slice(0, NEXT_DATES);
    const used = zeroKinds();
    for (const kind of TASK_KINDS) used[kind] = ws.ledgers[kind].used[ta.id] ?? 0;
    result[ta.id] = { used, counts: counts[ta.id], totalOccurrences: totals[ta.id], nextDates };
  }
  return result;
}
