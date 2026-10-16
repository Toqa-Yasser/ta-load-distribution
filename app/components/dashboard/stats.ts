import type { ISODate, Workspace } from "~/engine/types";

export type TAStats = { totalOccurrences: number; nextDates: ISODate[] };

const NEXT_DATES = 3;

/** Per TA: total occurrences across all tasks and the first few distinct dates on or after `today`. */
export function taStats(ws: Workspace, today: ISODate): Record<string, TAStats> {
  const totals: Record<string, number> = {};
  const upcoming: Record<string, Set<ISODate>> = {};
  for (const ta of ws.tas) {
    totals[ta.id] = 0;
    upcoming[ta.id] = new Set();
  }
  for (const task of ws.tasks) {
    for (const o of task.occurrences) {
      if (!(o.taId in totals)) continue;
      totals[o.taId] += 1;
      if (o.date >= today) upcoming[o.taId].add(o.date);
    }
  }
  const result: Record<string, TAStats> = {};
  for (const ta of ws.tas) {
    // ISO yyyy-MM-dd strings sort chronologically.
    const nextDates = [...upcoming[ta.id]].sort().slice(0, NEXT_DATES);
    result[ta.id] = { totalOccurrences: totals[ta.id], nextDates };
  }
  return result;
}
