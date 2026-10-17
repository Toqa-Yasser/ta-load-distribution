import { emptyWorkspace } from "~/engine/empty";
import { upgradeWorkspace } from "~/engine/migrate";
import { defaultContext, describe, reduce, type ReduceContext } from "~/engine/reducer";
import { seededRng } from "~/engine/rng";
import { EngineError, ValidationError } from "~/engine/types";
import type { Command, Workspace } from "~/engine/types";
import { checkHistoryPassword } from "./password.server";
import { INVALID_COMMAND_MESSAGE } from "./responses.server";
import type { Store, WorkspaceRow } from "./store";

export const AUTO_SNAPSHOT_KEEP = 300;
const MAX_ATTEMPTS = 3;

type SaveResult = { workspace: Workspace; version: number; snapshotId: number };
type CommandResult = SaveResult & { label: string };

const UPGRADE_SNAPSHOT_LABEL = "Upgraded to co-staffed dates";

function conflict(): EngineError {
  return new EngineError("Someone else saved at the same time. Please retry.", "CONFLICT");
}

/**
 * Brings a stored row up to the current shape. When the document changed, it is written back once
 * with the original kept as an auto snapshot; if another instance got there first we re-read
 * theirs. An unrecognisable document throws a ValidationError rather than being overwritten.
 */
async function upgradeRow(store: Store, row: WorkspaceRow): Promise<WorkspaceRow> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const data = upgradeWorkspace(row.data);
    if (data === row.data) return row;
    if (await store.putWorkspace(data, row.version)) {
      await store.insertSnapshot({ name: null, label: UPGRADE_SNAPSHOT_LABEL, kind: "auto", version: row.version, data: row.data });
      return { data, version: row.version + 1 };
    }
    const latest = await store.getWorkspace();
    if (!latest) throw conflict();
    row = latest;
  }
  throw conflict();
}

export async function loadWorkspace(store: Store): Promise<WorkspaceRow> {
  const existing = await store.getWorkspace();
  if (existing) return upgradeRow(store, existing);
  const data = emptyWorkspace();
  if (await store.putWorkspace(data, null)) return { data, version: 1 };
  // Lost a creation race; the winner's document exists now.
  const created = await store.getWorkspace();
  if (!created) throw conflict();
  return upgradeRow(store, created);
}

// Writes `next` over the version we read, then records `old` as an auto snapshot.
// The snapshot is inserted only after the put succeeds so a conflict leaves no orphan.
async function commit(store: Store, old: WorkspaceRow, next: Workspace, label: string): Promise<SaveResult | null> {
  if (!(await store.putWorkspace(next, old.version))) return null;
  const snapshotId = await store.insertSnapshot({ name: null, label, kind: "auto", version: old.version, data: old.data });
  await store.pruneAutoSnapshots(AUTO_SNAPSHOT_KEEP);
  return { workspace: next, version: old.version + 1, snapshotId };
}

/** FNV-1a (32-bit) over `${version}:${JSON.stringify(cmd)}`. */
export function commandSeed(version: number, cmd: Command): number {
  const text = `${version}:${JSON.stringify(cmd)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The RNG is derived from the document version and the command, so a preview and the
 * commit that follows it (at the same version) deal identical TAs. An explicit ctx (tests) wins.
 */
function contextFor(row: WorkspaceRow, cmd: Command, ctx: ReduceContext | undefined): ReduceContext {
  return ctx ?? { ...defaultContext(), rng: seededRng(commandSeed(row.version, cmd)) };
}

/**
 * Commands come from untrusted JSON. A known `type` with malformed fields makes the reducer or
 * describe() trip over a missing value (e.g. `undefined.trim()`); report that as a bad command.
 */
function asCommandError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof TypeError) {
      console.error(e);
      throw new ValidationError(INVALID_COMMAND_MESSAGE);
    }
    throw e;
  }
}

const describeCommand = (cmd: Command, ws: Workspace): string => asCommandError(() => describe(cmd, ws));

/** Applies `cmd` and saves it; `label` describes the command against the document it was applied to. */
export async function applyCommand(store: Store, cmd: Command, ctx?: ReduceContext): Promise<CommandResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const old = await loadWorkspace(store);
    // Described before reducing: a malformed command then fails as "Invalid command." (a TypeError
    // in describe) rather than with whatever the reducer trips over first.
    const label = describeCommand(cmd, old.data);
    // Re-derived per attempt: a conflict retry builds on the newer version.
    const next = asCommandError(() => reduce(old.data, cmd, contextFor(old, cmd, ctx)));
    // Put first, then snapshot (see commit): a crash between the two leaves this one change
    // without an Undo snapshot, which we accept to avoid orphan snapshots on version conflicts.
    const saved = await commit(store, old, next, label);
    if (saved) return { ...saved, label };
  }
  throw conflict();
}

export async function previewCommand(store: Store, cmd: Command, ctx?: ReduceContext): Promise<Workspace> {
  const row = await loadWorkspace(store);
  return asCommandError(() => reduce(row.data, cmd, contextFor(row, cmd, ctx)));
}

export async function rollback(store: Store, snapshotId: number): Promise<SaveResult> {
  const snap = await store.getSnapshot(snapshotId);
  if (!snap) throw new EngineError("That snapshot no longer exists.", "NOT_FOUND");
  // An auto snapshot is the state from just before its labelled change; a manual one has a name.
  const label = snap.kind === "auto" ? `Rolled back to before "${snap.label}"` : `Rolled back to "${snap.name ?? snap.label}"`;
  // Snapshots taken before v1.1 hold legacy documents (typed Workspace, see store.ts).
  const data = upgradeWorkspace(snap.data);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const old = await loadWorkspace(store);
    const saved = await commit(store, old, data, label);
    if (saved) return saved;
  }
  throw conflict();
}

export async function saveSnapshot(store: Store, name: string): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError("Snapshot name is required.");
  const cur = await loadWorkspace(store);
  return store.insertSnapshot({ name: trimmed, label: `Snapshot "${trimmed}"`, kind: "manual", version: cur.version, data: cur.data });
}

export const listSnapshots = (store: Store) => store.listSnapshots();

export async function deleteHistory(store: Store, password: string, configured: string | undefined): Promise<boolean> {
  if (!checkHistoryPassword(password, configured)) return false;
  await store.deleteAllSnapshots();
  return true;
}
