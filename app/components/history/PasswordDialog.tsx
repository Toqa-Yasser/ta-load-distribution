import { useEffect, useId, useState, type FormEvent } from "react";
import { INPUT_CLASS } from "~/components/ui/input";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { Sheet } from "~/components/ui/Sheet";

type PasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Resolves true on success (the caller closes the dialog), false to keep it open. */
  onSubmit: (password: string) => Promise<boolean>;
  /** The server's message for the last failed attempt, e.g. "Wrong password.". */
  error: string | undefined;
  pending: boolean;
};

/** Asks for the history-delete password; the check happens server-side only. */
export function PasswordDialog({ open, onClose, onSubmit, error, pending }: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const formId = useId();

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setFailed(false);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || pending) return;
    setFailed(!(await onSubmit(password)));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Delete history"
      footer={
        // In the sticky footer, outside the form: `form` ties the submit button to it.
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={!password} loading={pending}>
            Delete all history
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-muted">
          Every snapshot is deleted for good, including the ones Undo uses. The current state is kept.
        </p>
        <Field label="Password" error={failed ? error : undefined}>
          <input
            type="password"
            autoComplete="current-password"
            data-autofocus
            className={INPUT_CLASS}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFailed(false);
            }}
          />
        </Field>
      </form>
    </Sheet>
  );
}
