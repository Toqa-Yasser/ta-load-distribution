import type { ReactNode } from "react";
import { Button } from "~/components/ui/Button";
import { Sheet } from "~/components/ui/Sheet";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Yes/no confirmation on top of Sheet; the confirm button takes focus on open. */
export function ConfirmDialog({ open, title, body, confirmLabel, danger = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="text-muted">{body}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} data-autofocus autoFocus onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
