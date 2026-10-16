import type { Workspace } from "~/engine/types";
import type { SnapshotMeta, Store, WorkspaceRow } from "./store";

type StoredSnapshot = SnapshotMeta & { data: Workspace };

export class MemoryStore implements Store {
  private ws: WorkspaceRow | null = null;
  private snaps: StoredSnapshot[] = [];
  private nextId = 1;

  async getWorkspace(): Promise<WorkspaceRow | null> {
    return this.ws ? structuredClone(this.ws) : null;
  }

  async putWorkspace(data: Workspace, expectedVersion: number | null): Promise<boolean> {
    if (expectedVersion === null) {
      if (this.ws) return false;
      this.ws = { data: structuredClone(data), version: 1 };
      return true;
    }
    if (!this.ws || this.ws.version !== expectedVersion) return false;
    this.ws = { data: structuredClone(data), version: expectedVersion + 1 };
    return true;
  }

  async insertSnapshot(s: Omit<SnapshotMeta, "id" | "createdAt"> & { data: Workspace }): Promise<number> {
    const id = this.nextId++;
    this.snaps.push({ ...s, data: structuredClone(s.data), id, createdAt: new Date().toISOString() });
    return id;
  }

  async listSnapshots(): Promise<SnapshotMeta[]> {
    return [...this.snaps]
      .sort((a, b) => b.id - a.id)
      .map(({ data: _data, ...meta }) => meta);
  }

  async getSnapshot(id: number): Promise<StoredSnapshot | null> {
    const s = this.snaps.find((x) => x.id === id);
    return s ? structuredClone(s) : null;
  }

  async pruneAutoSnapshots(keep: number): Promise<void> {
    const autoIds = this.snaps.filter((s) => s.kind === "auto").map((s) => s.id).sort((a, b) => b - a);
    const drop = new Set(autoIds.slice(keep));
    this.snaps = this.snaps.filter((s) => !drop.has(s.id));
  }

  async deleteAllSnapshots(): Promise<void> {
    this.snaps = [];
  }
}
