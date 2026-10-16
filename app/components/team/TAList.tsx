import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Field } from "~/components/ui/Field";
import type { TA } from "~/engine/types";
import { INPUT_CLASS, InlineRename } from "./InlineRename";
import { TAChip } from "./TAChip";

type TAListProps = {
  tas: TA[];
  capacities: Record<string, number>;
  occurrenceCounts: Record<string, number>;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
};

/** TA roster: add inline, tap a chip to rename, drag a chip onto a section slot. */
export function TAList({ tas, capacities, occurrenceCounts, onAdd, onRename, onRemove }: TAListProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TA | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="New TA">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Name"
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Button type="submit" disabled={!draft.trim()}>
          Add
        </Button>
      </form>

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {tas.map((ta) => (
            <motion.li
              key={ta.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5"
            >
              <div className="min-w-0 flex-1">
                {editingId === ta.id ? (
                  <InlineRename
                    value={ta.name}
                    label={`Rename ${ta.name}`}
                    onCommit={(name) => {
                      setEditingId(null);
                      onRename(ta.id, name);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <TAChip ta={ta} capacity={capacities[ta.id] ?? 0} onClick={() => setEditingId(ta.id)} />
                )}
              </div>
              <Button variant="ghost" icon aria-label={`Remove ${ta.name}`} title="Remove TA" onClick={() => setRemoving(ta)}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={removing !== null}
        title="Remove TA?"
        body={
          removing
            ? `${removing.name} has ${occurrenceCounts[removing.id] ?? 0} task occurrences; they will be re-distributed to the other TAs.`
            : ""
        }
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (removing) onRemove(removing.id);
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
