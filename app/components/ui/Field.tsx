import { cloneElement, useId, type ReactElement } from "react";

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };
type FieldProps = { label: string; hint?: string; error?: string; children: ReactElement<ControlProps> };

/**
 * Label + optional hint/error around a single form control. The control is wired up by
 * cloning: it gets an id (unless it has one), aria-describedby for the hint/error and
 * aria-invalid when there is an error.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const autoId = useId();
  const id = children.props.id ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [children.props["aria-describedby"], hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} aria-live="polite" className="text-xs font-medium text-accent-2">
          {error}
        </p>
      )}
    </div>
  );
}
