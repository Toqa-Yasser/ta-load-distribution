import { INPUT_CLASS } from "~/components/ui/input";
import { Field } from "~/components/ui/Field";

type StepNameProps = {
  title: string;
  notes: string;
  onChange: (next: { title: string; notes: string }) => void;
  /** Enter in the title field moves on (when the step is valid). */
  onSubmit: () => void;
};

/** Step 1 of New task: title (required) and optional notes. */
export function StepName({ title, notes, onChange, onSubmit }: StepNameProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Field label="Title">
        <input
          data-autofocus
          value={title}
          onChange={(e) => onChange({ title: e.target.value, notes })}
          placeholder="e.g. Quiz grading"
          autoComplete="off"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Notes" hint="Optional">
        <textarea
          value={notes}
          onChange={(e) => onChange({ title, notes: e.target.value })}
          rows={3}
          className={`${INPUT_CLASS} resize-y py-2`}
        />
      </Field>
      {/* Lets Enter in the title submit the form without a visible duplicate of the Next button. */}
      <button type="submit" hidden />
    </form>
  );
}
