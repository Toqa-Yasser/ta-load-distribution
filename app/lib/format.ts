import { format, parseISO } from "date-fns";
import type { ISODate, Schedule } from "~/engine/types";

/** "Oct 20" */
export function fmtDate(iso: ISODate): string {
  return format(parseISO(iso), "MMM d");
}

/** "Mon, Oct 20 2026" */
export function fmtDateLong(iso: ISODate): string {
  return format(parseISO(iso), "EEE, MMM d yyyy");
}

const RECURRING_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;

/** One-line human summary of a schedule, e.g. "Weekly · Oct 1 → end of semester". */
export function fmtScheduleSummary(s: Schedule): string {
  switch (s.type) {
    case "one-time":
      return `One-time · ${fmtDate(s.date)}`;
    case "daily":
    case "weekly":
    case "monthly": {
      const end = s.end === null ? "end of semester" : fmtDate(s.end);
      return `${RECURRING_LABEL[s.type]} · ${fmtDate(s.start)} → ${end}`;
    }
    case "custom": {
      const n = s.dates.length;
      return `Custom · ${n} ${n === 1 ? "date" : "dates"}`;
    }
  }
}

/** "1 occurrence", "3 occurrences" */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
