import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "~/engine/types";
import type { SnapshotMeta, Store, WorkspaceRow } from "./store";

const META_COLUMNS = "id, name, label, kind, version, created_at";

type SnapshotDbRow = { id: number; name: string | null; label: string; kind: "auto" | "manual"; version: number; created_at: string };

function toMeta(r: SnapshotDbRow): SnapshotMeta {
  return { id: Number(r.id), name: r.name, label: r.label, kind: r.kind, version: r.version, createdAt: r.created_at };
}

export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }

  async getWorkspace(): Promise<WorkspaceRow | null> {
    const { data, error } = await this.db.from("workspace").select("data, version").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data ? { data: data.data as Workspace, version: data.version as number } : null;
  }

  async putWorkspace(data: Workspace, expectedVersion: number | null): Promise<boolean> {
    if (expectedVersion === null) {
      const { error } = await this.db.from("workspace").insert({ id: 1, data, version: 1 });
      if (error) {
        if (error.code === "23505") return false; // row already exists
        throw error;
      }
      return true;
    }
    const { data: rows, error } = await this.db
      .from("workspace")
      .update({ data, version: expectedVersion + 1, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .eq("version", expectedVersion)
      .select("version");
    if (error) throw error;
    return rows.length === 1;
  }

  async insertSnapshot(s: Omit<SnapshotMeta, "id" | "createdAt"> & { data: Workspace }): Promise<number> {
    const { data, error } = await this.db
      .from("snapshots")
      .insert({ name: s.name, label: s.label, kind: s.kind, version: s.version, data: s.data })
      .select("id")
      .single();
    if (error) throw error;
    return Number(data.id);
  }

  async listSnapshots(): Promise<SnapshotMeta[]> {
    const { data, error } = await this.db.from("snapshots").select(META_COLUMNS).order("id", { ascending: false }).limit(500);
    if (error) throw error;
    return (data as SnapshotDbRow[]).map(toMeta);
  }

  async getSnapshot(id: number): Promise<(SnapshotMeta & { data: Workspace }) | null> {
    const { data, error } = await this.db.from("snapshots").select(`${META_COLUMNS}, data`).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as SnapshotDbRow & { data: Workspace };
    return { ...toMeta(row), data: row.data };
  }

  async pruneAutoSnapshots(keep: number): Promise<void> {
    const { data, error } = await this.db.from("snapshots").select("id").eq("kind", "auto").order("id", { ascending: false }).limit(1000);
    if (error) throw error;
    const stale = (data ?? []).slice(keep).map((r) => r.id as number);
    if (stale.length === 0) return;
    const { error: delError } = await this.db.from("snapshots").delete().in("id", stale);
    if (delError) throw delError;
  }

  async deleteAllSnapshots(): Promise<void> {
    const { error } = await this.db.from("snapshots").delete().gte("id", 0);
    if (error) throw error;
  }
}
