import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import type { SnapshotMeta } from "~/server/store";
import { SnapshotRow } from "./SnapshotRow";

type SnapshotListProps = { snapshots: SnapshotMeta[]; currentVersion: number; onRollback: (id: number) => void };

const UNDO_NOTE = "The current state is saved first, so you can undo this.";

function rollbackBody(s: SnapshotMeta): string {
  return s.kind === "auto"
    ? `Restores the state from just before "${s.label}". ${UNDO_NOTE}`
    : `Restores the snapshot "${s.name ?? s.label}". ${UNDO_NOTE}`;
}

/**
 * Snapshots newest first, under a "Now" marker for the current version. The newest snapshot
 * holds the state just before the current version, so it is tagged "Latest change".
 */
export function SnapshotList({ snapshots, currentVersion, onRollback }: SnapshotListProps) {
  // The id stays set after closing so the dialog can animate out.
  const [target, setTarget] = useState<{ snapshot: SnapshotMeta; open: boolean } | null>(null);
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
            <SnapshotRow key={s.id} snapshot={s} latest={i === 0} onRollback={() => setTarget({ snapshot: s, open: true })} />
          ))}
        </AnimatePresence>
      </ol>
      <ConfirmDialog
        open={target?.open ?? false}
        title="Roll back?"
        body={target ? rollbackBody(target.snapshot) : ""}
        confirmLabel="Roll back"
        onConfirm={() => {
          if (target) onRollback(target.snapshot.id);
          close();
        }}
        onClose={close}
      />
    </>
  );
}
