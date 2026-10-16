import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import type { SnapshotMeta } from "~/server/store";
import { SnapshotRow } from "./SnapshotRow";

type SnapshotListProps = { snapshots: SnapshotMeta[]; currentVersion: number; onRollback: (id: number) => void };

/**
 * Snapshots newest first, under a "Now" marker for the current version. The newest snapshot
 * holds the state just before the current version, so it is tagged "Latest change".
 */
export function SnapshotList({ snapshots, currentVersion, onRollback }: SnapshotListProps) {
  // The id stays set after closing so the dialog can animate out.
  const [target, setTarget] = useState<{ id: number; open: boolean } | null>(null);
  const close = () => setTarget((t) => t && { ...t, open: false });

  return (
    <>
      <ol aria-label="Snapshots" className="flex flex-col gap-2">
        <li className="flex items-center gap-2 px-4 py-1 text-sm text-muted">
          <span aria-hidden className="size-2 rounded-full bg-mint" />
          Now · version {currentVersion}
        </li>
        <AnimatePresence initial={false}>
          {snapshots.map((s, i) => (
            <SnapshotRow key={s.id} snapshot={s} latest={i === 0} onRollback={() => setTarget({ id: s.id, open: true })} />
          ))}
        </AnimatePresence>
      </ol>
      <ConfirmDialog
        open={target?.open ?? false}
        title="Roll back?"
        body="Roll back to this snapshot? The current state is saved first, so you can undo this."
        confirmLabel="Roll back"
        onConfirm={() => {
          if (target) onRollback(target.id);
          close();
        }}
        onClose={close}
      />
    </>
  );
}
