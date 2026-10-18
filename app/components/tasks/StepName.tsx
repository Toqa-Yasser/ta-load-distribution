import { INPUT_CLASS } from "~/components/ui/input";
import { Field } from "~/components/ui/Field";
import { Segmented } from "~/components/ui/Segmented";
import { Stepper } from "~/components/ui/Stepper";
import { KIND_LABEL, TASK_KINDS, type TA, type TaskKind } from "~/engine/types";
import { TAOrderList } from "./TAOrderList";

type StepNameValue = { kind: TaskKind; title: string; notes: string; taCount: number; taOrder: string[] };

type StepNameProps = StepNameValue & {
  /** Most TAs a date can ask for: those holding a section slot, or the whole team for equal (at least 1). */
  maxTaCount: number;
  /** The team, in Team page order; an equal task's order is picked from it. */
  tas: TA[];
  onChange: (next: StepNameValue) => void;
  /** Enter in the title field moves on (when the step is valid). */
  onSubmit: () => void;
};

const KIND_HINT_ID = "new-task-kind-hint";
const TA_COUNT_HINT_ID = "new-task-tacount-hint";

/** Reconciles a stored order with the current team: drops unknown ids, appends new TAs in team order. */
export function reconcileOrder(order: string[], tas: TA[]): string[] {
  const known = new Set(tas.map((t) => t.id));
  const kept = order.filter((id) => known.has(id));
  const seen = new Set(kept);
  return [...kept, ...tas.filter((t) => !seen.has(t.id)).map((t) => t.id)];
}

function taCountHint(kind: TaskKind, maxTaCount: number): string {
  if (kind === "equal") {
    return maxTaCount > 1 ? "Each date is covered by this many TAs together, taken in turn from the order." : "Add more TAs to co-staff dates.";
  }
  return maxTaCount > 1
    ? "Each date is covered by this many TAs together. Every one of them counts it toward their load."
    : "Give more TAs sections to co-staff dates.";
}

/** Step 1 of New task: kind (light / heavy / equal), the equal order, title (required) and optional notes. */
export function StepName({ kind, title, notes, taCount, taOrder, maxTaCount, tas, onChange, onSubmit }: StepNameProps) {
  const value: StepNameValue = { kind, title, notes, taCount, taOrder };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Segmented
          label="Kind"
          layoutId="task-kind-pill"
          className="grid-cols-3"
          describedBy={KIND_HINT_ID}
          options={TASK_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          value={kind}
          onChange={(k) => onChange({ ...value, kind: k })}
        />
        <p id={KIND_HINT_ID} className="text-sm text-muted">
          {kind === "equal"
            ? "Equal tasks go round the TAs in the order below, one date each, whatever their sections."
            : "Light and heavy tasks are shared out independently — each has its own fairness counter."}
        </p>
      </div>
      {kind === "equal" && (
        <TAOrderList tas={tas} order={reconcileOrder(taOrder, tas)} onChange={(o) => onChange({ ...value, taOrder: o })} />
      )}
      <div className="flex flex-col gap-2">
        <Stepper
          label="TAs per date"
          min={1}
          max={maxTaCount}
          value={taCount}
          describedBy={TA_COUNT_HINT_ID}
          onChange={(n) => onChange({ ...value, taCount: n })}
        />
        <p id={TA_COUNT_HINT_ID} className="text-sm text-muted">
          {taCountHint(kind, maxTaCount)}
        </p>
      </div>
      <Field label="Title">
        <input
          data-autofocus
          value={title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="e.g. Quiz grading"
          autoComplete="off"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Notes" hint="Optional">
        <textarea
          value={notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={3}
          className={`${INPUT_CLASS} resize-y py-2`}
        />
      </Field>
      {/* Lets Enter in the title submit the form without a visible duplicate of the Next button. */}
      <button type="submit" hidden />
    </form>
  );
}
