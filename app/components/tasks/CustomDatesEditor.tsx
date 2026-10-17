import { addDays, format, parseISO } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FIELD_FOCUS, INPUT_CLASS } from "~/components/ui/input";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { CloseIcon } from "~/components/ui/icons";
import { customDates } from "~/engine/schedule";
import type { ISODate } from "~/engine/types";
import { fmtDate } from "~/lib/format";
import { usePressMotion } from "~/lib/motion";

export type CustomDates = { start: ISODate; count: number; gapDays: number; dates: ISODate[] };

type CustomDatesEditorProps = CustomDates & { onChange: (next: CustomDates) => void };

const MAX_DATES = 500;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const normalize = (dates: ISODate[]) => [...new Set(dates)].sort();

/** Integer input that keeps its own text (so it can be cleared while typing), shows and emits clamped values as you type and resyncs on blur. */
function IntInput({
  value,
  min,
  max,
  onValue,
  ...aria
}: { value: number; min: number; max: number; onValue: (n: number) => void; id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      {...aria} // id/aria-* from <Field>, so the label is associated
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const n = Math.round(Number(raw));
        if (raw === "" || !Number.isFinite(n)) {
          setText(raw);
          return;
        }
        // Out-of-range input shows the clamped value straight away, not only after blur.
        const clamped = clamp(n, min, max);
        setText(clamped === n ? raw : String(clamped));
        onValue(clamped);
      }}
      onBlur={() => setText(String(value))}
      className={INPUT_CLASS}
    />
  );
}

function DateChip({ date, onEdit, onRemove }: { date: ISODate; onEdit: (next: ISODate) => void; onRemove: () => void }) {
  const press = usePressMotion();
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const commit = (value: string) => {
    setEditing(false);
    if (value && value !== date) onEdit(value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(e.currentTarget.value);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setEditing(false);
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      className="flex items-center rounded-field border border-line bg-surface"
    >
      {editing ? (
        <input
          ref={input}
          type="date"
          aria-label={`Edit ${fmtDate(date)}`}
          defaultValue={date}
          onKeyDown={onKeyDown}
          onBlur={(e) => commit(e.currentTarget.value)}
          className={`min-h-11 rounded-l-field bg-transparent px-2 text-sm text-ink ${FIELD_FOCUS}`}
        />
      ) : (
        <motion.button
          type="button"
          {...press}
          title="Edit date"
          onClick={() => setEditing(true)}
          className="min-h-11 rounded-l-field px-3 text-sm font-medium tabular-nums text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {fmtDate(date)}
        </motion.button>
      )}
      <motion.button
        type="button"
        whileTap={press.whileTap}
        aria-label={`Remove ${fmtDate(date)}`}
        onClick={onRemove}
        className="grid size-11 place-items-center rounded-r-field text-muted hover:bg-ink/5 hover:text-danger-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <CloseIcon size={14} />
      </motion.button>
    </motion.li>
  );
}

/** Custom schedule: generate `count` dates `gapDays` apart from `start`, then edit, remove or add chips. */
export function CustomDatesEditor({ start, count, gapDays, dates, onChange }: CustomDatesEditorProps) {
  const current = { start, count, gapDays, dates };
  const set = (patch: Partial<CustomDates>) => onChange({ ...current, ...patch });

  const generate = () => {
    const n = clamp(Math.round(count) || 1, 1, MAX_DATES);
    set({ count: n, dates: customDates(start, n, gapDays) });
  };
  const add = () => {
    const last = dates[dates.length - 1];
    const next = last ? format(addDays(parseISO(last), gapDays), "yyyy-MM-dd") : start;
    set({ dates: normalize([...dates, next]) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem_6rem] sm:items-end">
        <Field label="First date">
          <input type="date" value={start} onChange={(e) => set({ start: e.target.value })} className={INPUT_CLASS} />
        </Field>
        <Field label="How many">
          <IntInput value={count} min={1} max={MAX_DATES} onValue={(n) => set({ count: n })} />
        </Field>
        <Field label="Every (days)">
          <IntInput value={gapDays} min={1} max={365} onValue={(n) => set({ gapDays: n })} />
        </Field>
      </div>
      <Button variant="ghost" className="self-start border border-line" disabled={!start} onClick={generate}>
        Generate
      </Button>

      <ul aria-label="Dates" className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {dates.map((d) => (
            <DateChip
              key={d}
              date={d}
              onEdit={(next) => set({ dates: normalize(dates.map((x) => (x === d ? next : x))) })}
              onRemove={() => set({ dates: dates.filter((x) => x !== d) })}
            />
          ))}
        </AnimatePresence>
        <motion.li layout>
          <Button variant="ghost" size="sm" disabled={!start || dates.length >= MAX_DATES} onClick={add} className="border border-dashed border-ink/20">
            + Add date
          </Button>
        </motion.li>
      </ul>
    </div>
  );
}
