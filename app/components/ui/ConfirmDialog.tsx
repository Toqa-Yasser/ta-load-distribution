import type { ReactNode } from "react";
import { Button } from "~/components/ui/Button";
import { Sheet, SHEET_ACTIONS } from "~/components/ui/Sheet";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Yes/no confirmation on top of Sheet; the confirm button takes focus on open (fine pointers). */
export function ConfirmDialog({ open, title, body, confirmLabel, danger = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5">
        <div className="text-muted">{body}</div>
        <div className={SHEET_ACTIONS}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} data-autofocus onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
