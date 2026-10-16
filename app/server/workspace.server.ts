import { emptyWorkspace } from "~/engine/empty";
import { defaultContext, describe, reduce, type ReduceContext } from "~/engine/reducer";
import { seededRng } from "~/engine/rng";
import { EngineError, ValidationError } from "~/engine/types";
import type { Command, Workspace } from "~/engine/types";
import { checkHistoryPassword } from "./password.server";
import type { Store, WorkspaceRow } from "./store";

export const AUTO_SNAPSHOT_KEEP = 300;
const MAX_ATTEMPTS = 3;

type SaveResult = { workspace: Workspace; version: number; snapshotId: number };

function conflict(): EngineError {
  return new EngineError("Someone else saved at the same time. Please retry.", "CONFLICT");
}

export async function loadWorkspace(store: Store): Promise<WorkspaceRow> {
  const existing = await store.getWorkspace();
  if (existing) return existing;
  const data = emptyWorkspace();
  if (await store.putWorkspace(data, null)) return { data, version: 1 };
  // Lost a creation race; the winner's document exists now.
  const created = await store.getWorkspace();
  if (!created) throw conflict();
  return created;
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

export async function applyCommand(store: Store, cmd: Command, ctx?: ReduceContext): Promise<SaveResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const old = await loadWorkspace(store);
    // Re-derived per attempt: a conflict retry builds on the newer version.
    const next = reduce(old.data, cmd, contextFor(old, cmd, ctx));
    const saved = await commit(store, old, next, describe(cmd, old.data));
    if (saved) return saved;
  }
  throw conflict();
}

export async function previewCommand(store: Store, cmd: Command, ctx?: ReduceContext): Promise<Workspace> {
  const row = await loadWorkspace(store);
  return reduce(row.data, cmd, contextFor(row, cmd, ctx));
}

export async function rollback(store: Store, snapshotId: number): Promise<SaveResult> {
  const snap = await store.getSnapshot(snapshotId);
  if (!snap) throw new EngineError("That snapshot no longer exists.", "NOT_FOUND");
  const label = `Rolled back to "${snap.name ?? snap.label}"`;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const old = await loadWorkspace(store);
    const saved = await commit(store, old, snap.data, label);
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
