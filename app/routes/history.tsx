import { useState, type FormEvent } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/history";
import { PasswordDialog } from "~/components/history/PasswordDialog";
import { SnapshotList } from "~/components/history/SnapshotList";
import { INPUT_CLASS } from "~/components/ui/input";
import { Button } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { HistoryIcon } from "~/components/ui/icons";
import { plural } from "~/lib/format";
import { stagger } from "~/lib/motion";
import { routeMeta } from "~/lib/seo";
import { HISTORY_FETCHER_KEYS, useHistory } from "~/lib/use-history";
import { getStore } from "~/server/store.server";
import { listSnapshots, loadWorkspace } from "~/server/workspace.server";

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta(matches, { title: "History", description: "Snapshots, rollback and reset.", path: "/history" });
}

export async function loader() {
  const store = getStore();
  return { snapshots: await listSnapshots(store), version: (await loadWorkspace(store)).version };
}

// While AppShell animates this page out, the router has already left the route and its loader
// data is undefined; render the empty state for those few frames instead of crashing.
const EMPTY_HISTORY: Awaited<ReturnType<typeof loader>> = { snapshots: [], version: 0 };

export default function History() {
  const { snapshots, version } = useLoaderData<typeof loader>() ?? EMPTY_HISTORY;
  const { rollback } = useHistory(HISTORY_FETCHER_KEYS.rollback);
  const { saveSnapshot } = useHistory(HISTORY_FETCHER_KEYS.snapshot);
  const { deleteHistory, pending, error } = useHistory(HISTORY_FETCHER_KEYS.deleteHistory);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    saveSnapshot(name.trim());
    setName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <header {...stagger(0, "rise", "flex flex-wrap items-end justify-between gap-3")}>
        <div>
          <h1 className="text-display font-semibold">History</h1>
          <p className="mt-1 text-muted">{plural(snapshots.length, "snapshot", "snapshots")}</p>
        </div>
        <Button variant="danger" disabled={snapshots.length === 0} onClick={() => setDeleting(true)}>
          Delete history
        </Button>
      </header>

      <form onSubmit={onSave} {...stagger(1, "rise", "glass flex flex-col gap-2 p-3 sm:flex-row sm:items-center")}>
        <label htmlFor="snapshot-name" className="sr-only">
          Snapshot name
        </label>
        <input
          id="snapshot-name"
          className={INPUT_CLASS}
          placeholder="Name this moment, e.g. Before exam"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" className="shrink-0" disabled={!name.trim()}>
          Save snapshot
        </Button>
      </form>

      {snapshots.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon />}
          title="No history yet"
          body="Every change saves a snapshot here, so you can roll back. Save one by name before big changes."
          action={{ label: "Name a snapshot", onClick: () => document.getElementById("snapshot-name")?.focus() }}
        />
      ) : (
        <div {...stagger(2)}>
          <SnapshotList snapshots={snapshots} currentVersion={version} onRollback={rollback} />
        </div>
      )}

      <PasswordDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        error={error}
        pending={pending}
        onSubmit={async (password) => {
          const ok = await deleteHistory(password);
          if (ok) setDeleting(false);
          return ok;
        }}
      />
    </div>
  );
}

