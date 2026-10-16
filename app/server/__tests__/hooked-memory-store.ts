import type { Workspace } from "~/engine/types";
import { MemoryStore } from "~/server/memory-store";

type Hook = (store: HookedMemoryStore) => void | Promise<void>;

/**
 * A MemoryStore with a conflict-injection point for tests: `beforePut` runs before every update
 * (never the initial create) and is not re-entered when it calls putWorkspace itself.
 */
export class HookedMemoryStore extends MemoryStore {
  private inHook = false;

  constructor(private beforePut: Hook) {
    super();
  }

  override async putWorkspace(data: Workspace, expectedVersion: number | null): Promise<boolean> {
    if (expectedVersion !== null && !this.inHook) {
      this.inHook = true;
      try { await this.beforePut(this); } finally { this.inHook = false; }
    }
    return super.putWorkspace(data, expectedVersion);
  }
}
