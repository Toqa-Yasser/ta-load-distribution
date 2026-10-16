import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { TooManyOccurrencesError, type ISODate, type Schedule, type Semester } from "~/engine/types";

const MAX_OCCURRENCES = 500;

function assertWithinLimit(dates: ISODate[]): ISODate[] {
  if (dates.length > MAX_OCCURRENCES) throw new TooManyOccurrencesError();
  return dates;
}

export function generateDates(schedule: Schedule, semester: Semester): ISODate[] {
  switch (schedule.type) {
    case "one-time":
    case "per-semester":
      return [schedule.date];

    case "custom": {
      const unique = [...new Set(schedule.dates)].sort();
      return assertWithinLimit(unique);
    }

    case "daily":
    case "weekly":
    case "monthly": {
      const shift =
        schedule.type === "daily"
          ? addDays
          : schedule.type === "weekly"
            ? addWeeks
            : addMonths;
      const origin = parseISO(schedule.start);
      const end = parseISO(schedule.end ?? semester.end);
      const out: ISODate[] = [];
      // Each occurrence is computed from the origin so month-end clamping does not drift.
      for (let k = 0; ; k++) {
        const d = shift(origin, k);
        if (d > end) break;
        out.push(format(d, "yyyy-MM-dd"));
        if (out.length > MAX_OCCURRENCES) throw new TooManyOccurrencesError();
      }
      return out;
    }
  }
}

export function customDates(start: ISODate, count: number, gapDays: number): ISODate[] {
  const origin = parseISO(start);
  const out: ISODate[] = [];
  for (let i = 0; i < count; i++) {
    out.push(format(addDays(origin, i * gapDays), "yyyy-MM-dd"));
  }
  return out;
}
