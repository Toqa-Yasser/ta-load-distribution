import type { Workspace } from "~/engine/types";

/**
 * `data` is typed as the current Workspace, but rows and snapshots written earlier hold a
 * legacy shape: v1.0 (one `ledger`, kindless tasks) or v1.1 (one TA per occurrence, no `taCount`).
 * Readers must pass stored data through
 * upgradeWorkspace() (loadWorkspace and rollback do) before treating it as a Workspace.
 */
export interface WorkspaceRow { data: Workspace; version: number }
export interface SnapshotMeta { id: number; name: string | null; label: string; kind: "auto" | "manual"; version: number; createdAt: string }
export interface Store {
  getWorkspace(): Promise<WorkspaceRow | null>;
  putWorkspace(data: Workspace, expectedVersion: number | null): Promise<boolean>; // null = create (version 1); false on conflict
  insertSnapshot(s: Omit<SnapshotMeta, "id" | "createdAt"> & { data: Workspace }): Promise<number>;
  listSnapshots(): Promise<SnapshotMeta[]>; // newest first
  getSnapshot(id: number): Promise<(SnapshotMeta & { data: Workspace }) | null>;
  pruneAutoSnapshots(keep: number): Promise<void>;
  deleteAllSnapshots(): Promise<void>;
}
