import { motion, useReducedMotion } from "motion/react";
import { INPUT_CLASS } from "~/components/team/InlineRename";
import { Field } from "~/components/ui/Field";
import { generateDates } from "~/engine/schedule";
import { TooManyOccurrencesError, type ISODate, type Schedule, type Semester } from "~/engine/types";
import { plural } from "~/lib/format";
import { indicatorSpring, usePressMotion } from "~/lib/motion";
import { CustomDatesEditor } from "./CustomDatesEditor";

type StepScheduleProps = { schedule: Schedule; semester: Semester; onChange: (next: Schedule) => void };

type ScheduleType = Schedule["type"];

const TYPES: { type: ScheduleType; label: string }[] = [
  { type: "one-time", label: "One-time" },
  { type: "daily", label: "Daily" },
  { type: "weekly", label: "Weekly" },
  { type: "monthly", label: "Monthly" },
  { type: "per-semester", label: "Per semester" },
  { type: "custom", label: "Custom" },
];

/**
 * How many dates a schedule yields, or why it can't be used. Shared by the live count here and
 * the sheet's Next button, so both agree.
 */
export function scheduleDates(schedule: Schedule, semester: Semester): { count: number; error: string | null } {
  try {
    const count = generateDates(schedule, semester).length;
    return { count, error: count === 0 ? "This schedule has no dates." : null };
  } catch (e) {
    if (e instanceof TooManyOccurrencesError) return { count: 0, error: e.message };
    // A cleared native date input yields "", which date-fns cannot parse.
    if (e instanceof RangeError) return { count: 0, error: "Pick a valid date." };
    throw e;
  }
}

const startOf = (s: Schedule): ISODate => ("date" in s ? s.date : s.start);

/** Switch type, carrying the start date (and a recurring end) across. */
function convert(s: Schedule, type: ScheduleType): Schedule {
  const start = startOf(s);
  switch (type) {
    case "one-time":
    case "per-semester":
      return { type, date: start };
    case "daily":
    case "weekly":
    case "monthly":
      return { type, start, end: "end" in s ? s.end : null };
    case "custom":
      return { type, start, count: 5, gapDays: 7, dates: [] };
  }
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  label: string;
  className: string;
}) {
  const reduced = useReducedMotion();
  const press = usePressMotion();
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-1 rounded-2xl border border-line bg-ink/[0.03] p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            {...press}
            onClick={() => onChange(o.value)}
            className={`relative isolate min-h-11 rounded-xl px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={reduced ? { duration: 0 } : indicatorSpring}
                className="absolute inset-0 -z-10 rounded-xl border border-line bg-surface shadow-sm"
              />
            )}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Step 2 of New task: pick a schedule type and its dates; shows a live occurrence count. */
export function StepSchedule({ schedule, semester, onChange }: StepScheduleProps) {
  const { count, error } = scheduleDates(schedule, semester);

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Repeats"
        layoutId="schedule-type-pill"
        className="grid-cols-3"
        options={TYPES.map((t) => ({ value: t.type, label: t.label }))}
        value={schedule.type}
        onChange={(type) => type !== schedule.type && onChange(convert(schedule, type))}
      />

      {(schedule.type === "one-time" || schedule.type === "per-semester") && (
        <Field label="Date">
          <input
            type="date"
            value={schedule.date}
            onChange={(e) => onChange({ ...schedule, date: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
      )}

      {(schedule.type === "daily" || schedule.type === "weekly" || schedule.type === "monthly") && (
        <div className="flex flex-col gap-4">
          <Field label="Starts">
            <input
              type="date"
              value={schedule.start}
              onChange={(e) => onChange({ ...schedule, start: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Segmented
            label="Ends"
            layoutId="schedule-end-pill"
            className="grid-cols-2"
            options={[
              { value: "semester", label: "Until end of semester" },
              { value: "date", label: "Until a date" },
            ]}
            value={schedule.end === null ? "semester" : "date"}
            onChange={(mode) => {
              const end = mode === "semester" ? null : semester.end;
              if (end !== schedule.end) onChange({ ...schedule, end });
            }}
          />
          {schedule.end !== null && (
            <Field label="Ends on">
              <input
                type="date"
                value={schedule.end}
                onChange={(e) => onChange({ ...schedule, end: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          )}
        </div>
      )}

      {schedule.type === "custom" && (
        <CustomDatesEditor
          start={schedule.start}
          count={schedule.count}
          gapDays={schedule.gapDays}
          dates={schedule.dates}
          onChange={(next) => onChange({ type: "custom", ...next })}
        />
      )}

      <p aria-live="polite" className={`text-sm font-medium ${error ? "text-accent-2" : "text-muted"}`}>
        {error ?? plural(count, "occurrence", "occurrences")}
      </p>
    </div>
  );
}
