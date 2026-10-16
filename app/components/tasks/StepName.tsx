import { INPUT_CLASS } from "~/components/ui/input";
import { Field } from "~/components/ui/Field";
import { Segmented } from "~/components/ui/Segmented";
import { TASK_KINDS, type TaskKind } from "~/engine/types";
import { KIND_LABEL } from "./KindBadge";

type StepNameValue = { kind: TaskKind; title: string; notes: string };

type StepNameProps = StepNameValue & {
  onChange: (next: StepNameValue) => void;
  /** Enter in the title field moves on (when the step is valid). */
  onSubmit: () => void;
};

const KIND_HINT_ID = "new-task-kind-hint";

/** Step 1 of New task: kind (light / heavy), title (required) and optional notes. */
export function StepName({ kind, title, notes, onChange, onSubmit }: StepNameProps) {
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
          className="grid-cols-2"
          describedBy={KIND_HINT_ID}
          options={TASK_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          value={kind}
          onChange={(k) => onChange({ kind: k, title, notes })}
        />
        <p id={KIND_HINT_ID} className="text-sm text-muted">
          Light and heavy tasks are shared out independently — each has its own fairness counter.
        </p>
      </div>
      <Field label="Title">
        <input
          data-autofocus
          value={title}
          onChange={(e) => onChange({ kind, title: e.target.value, notes })}
          placeholder="e.g. Quiz grading"
          autoComplete="off"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Notes" hint="Optional">
        <textarea
          value={notes}
          onChange={(e) => onChange({ kind, title, notes: e.target.value })}
          rows={3}
          className={`${INPUT_CLASS} resize-y py-2`}
        />
      </Field>
      {/* Lets Enter in the title submit the form without a visible duplicate of the Next button. */}
      <button type="submit" hidden />
    </form>
  );
}
