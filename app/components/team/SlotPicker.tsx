import { motion } from "motion/react";
import { Button } from "~/components/ui/Button";
import { Sheet } from "~/components/ui/Sheet";
import type { TA } from "~/engine/types";
import { usePressMotion } from "~/lib/motion";

type SlotPickerProps = {
  open: boolean;
  title: string;
  tas: TA[];
  /** The TA currently in the slot; when set, a "Clear" option is offered. */
  currentTaId: string | null;
  onPick: (taId: string | null) => void;
  onClose: () => void;
};

/** Tap-to-assign alternative to drag and drop: lists TAs as large buttons. */
export function SlotPicker({ open, title, tas, currentTaId, onPick, onClose }: SlotPickerProps) {
  const press = usePressMotion();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {tas.length === 0 ? (
        <p className="py-4 text-sm text-muted">Add a TA first, then come back to fill this slot.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tas.map((ta, i) => {
            const current = ta.id === currentTaId;
            return (
              <li key={ta.id}>
                <motion.button
                  type="button"
                  {...press}
                  data-autofocus={i === 0 ? true : undefined}
                  aria-pressed={current}
                  onClick={() => onPick(ta.id)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-medium transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent ${
                    current ? "bg-accent/10 text-accent-ink" : "text-ink"
                  }`}
                >
                  <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta.color }} />
                  {ta.name}
                </motion.button>
              </li>
            );
          })}
        </ul>
      )}
      {currentTaId !== null && (
        <Button variant="danger" className="mt-4 w-full" onClick={() => onPick(null)}>
          Clear
        </Button>
      )}
    </Sheet>
  );
}
