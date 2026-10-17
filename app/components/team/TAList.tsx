import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Field } from "~/components/ui/Field";
import { IconButton } from "~/components/ui/IconButton";
import { TrashIcon } from "~/components/ui/icons";
import { INPUT_CLASS } from "~/components/ui/input";
import type { TA } from "~/engine/types";
import { plural } from "~/lib/format";
import { useRetained } from "~/lib/retain";
import { InlineRename } from "./InlineRename";
import { TAChip } from "./TAChip";

type TAListProps = {
  tas: TA[];
  capacities: Record<string, number>;
  occurrenceCounts: Record<string, number>;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  /** A command is in flight: the Add button is disabled so a double submit can't add twice. */
  pending?: boolean;
};

/** Id of the "New TA" name input, so an empty state can send focus to it. */
export const NEW_TA_INPUT_ID = "new-ta-name";

/** TA roster: add inline, tap a chip to rename, drag a chip onto a section slot. */
export function TAList({ tas, capacities, occurrenceCounts, onAdd, onRename, onRemove, pending = false }: TAListProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TA | null>(null);
  // The confirm keeps naming its TA while it animates out.
  const shown = useRetained(removing);

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
              id={NEW_TA_INPUT_ID}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Name"
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Button type="submit" disabled={!draft.trim() || pending}>
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
              className="flex items-center gap-2"
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
              <IconButton aria-label={`Remove ${ta.name}`} title="Remove TA" onClick={() => setRemoving(ta)}>
                <TrashIcon />
              </IconButton>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={removing !== null}
        title="Remove TA?"
        body={
          shown
            ? `${shown.name} has ${plural(occurrenceCounts[shown.id] ?? 0, "task occurrence", "task occurrences")}; they will be re-distributed to the other TAs.`
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
