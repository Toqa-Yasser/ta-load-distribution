import { addDays, addMonths, format, parseISO, startOfWeek } from "date-fns";
import type { ISODate, Occurrence, Task } from "~/engine/types";

export type MonthCell = { date: ISODate; inMonth: boolean };
export type DayEntry = { task: Task; occ: Occurrence };

const GRID_DAYS = 42; // 6 weeks × 7 days
const firstOf = (yearMonth: string) => parseISO(`${yearMonth}-01`);

/** 6×7 grid for `yearMonth` ("2026-10"), starting on the Monday on or before the 1st. */
export function monthCells(yearMonth: string): MonthCell[] {
  const start = startOfWeek(firstOf(yearMonth), { weekStartsOn: 1 });
  return Array.from({ length: GRID_DAYS }, (_, i) => {
    const date = format(addDays(start, i), "yyyy-MM-dd");
    return { date, inMonth: date.startsWith(yearMonth) };
  });
}

/** Occurrences keyed by date; within a date, in task order then occurrence order. */
export function occurrencesByDate(tasks: Task[]): Map<ISODate, DayEntry[]> {
  const map = new Map<ISODate, DayEntry[]>();
  for (const task of tasks) {
    for (const occ of task.occurrences) {
      const list = map.get(occ.date);
      if (list) list.push({ task, occ });
      else map.set(occ.date, [{ task, occ }]);
    }
  }
  return map;
}

/** "2026-12" + 1 → "2027-01" */
export function shiftMonth(yearMonth: string, delta: number): string {
  return format(addMonths(firstOf(yearMonth), delta), "yyyy-MM");
}

/** "2026-10" → "October 2026" */
export function fmtMonth(yearMonth: string): string {
  return format(firstOf(yearMonth), "MMMM yyyy");
}
