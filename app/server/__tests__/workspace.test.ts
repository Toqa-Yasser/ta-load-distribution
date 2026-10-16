import { MemoryStore } from "~/server/memory-store";
import { applyCommand, loadWorkspace, previewCommand, rollback, saveSnapshot, deleteHistory, AUTO_SNAPSHOT_KEEP } from "~/server/workspace.server";
import { testContext } from "~/engine/reducer";
import { EngineError } from "~/engine/types";

test("loadWorkspace creates an empty workspace at version 1", async () => {
  const store = new MemoryStore();
  expect(await loadWorkspace(store)).toMatchObject({ version: 1, data: { tas: [] } });
});
test("applyCommand saves, bumps the version and writes an auto snapshot of the previous state", async () => {
  const store = new MemoryStore();
  const r = await applyCommand(store, { type: "addTA", name: "Ahmed" }, testContext());
  expect(r.version).toBe(2);
  expect(r.workspace.tas[0].name).toBe("Ahmed");
  const snaps = await store.listSnapshots();
  expect(snaps).toHaveLength(1);
  expect(snaps[0]).toMatchObject({ kind: "auto", label: 'Added TA "Ahmed"', version: 1 });
  expect((await store.getSnapshot(snaps[0].id))!.data.tas).toEqual([]);
});
test("applyCommand retries once on version conflict", async () => {
  let fired = false;
  const store = new MemoryStore({ beforePut: async (s) => { if (!fired) { fired = true; await s.putWorkspace({ ...(await s.getWorkspace())!.data, semester: { name: "X", start: "2026-01-01", end: "2026-12-31" } }, 1); } } });
  const r = await applyCommand(store, { type: "addTA", name: "Ahmed" }, testContext());
  expect(r.version).toBe(3);
  expect(r.workspace.semester.name).toBe("X");       // built on the newer document
  expect(r.workspace.tas[0].name).toBe("Ahmed");
});
test("applyCommand gives up after three conflicts", async () => {
  const store = new MemoryStore({ beforePut: async (s) => { const w = (await s.getWorkspace())!; await s.putWorkspace(w.data, w.version); } });
  await expect(applyCommand(store, { type: "addTA", name: "A" }, testContext())).rejects.toMatchObject({ code: "CONFLICT" });
});
test("engine errors propagate and nothing is saved", async () => {
  const store = new MemoryStore();
  await expect(applyCommand(store, { type: "addTA", name: " " }, testContext())).rejects.toBeInstanceOf(EngineError);
  expect(await store.listSnapshots()).toHaveLength(0);
});
test("previewCommand does not save", async () => {
  const store = new MemoryStore();
  const ws = await previewCommand(store, { type: "addTA", name: "A" }, testContext());
  expect(ws.tas).toHaveLength(1);
  expect((await loadWorkspace(store)).data.tas).toHaveLength(0);
});
test("rollback restores a snapshot and records the rollback itself", async () => {
  const store = new MemoryStore();
  await applyCommand(store, { type: "addTA", name: "A" }, testContext());
  const [snap] = await store.listSnapshots();
  const r = await rollback(store, snap.id);
  expect(r.workspace.tas).toEqual([]);
  expect((await store.listSnapshots())[0].label).toBe('Rolled back to "Added TA \"A\""');
});
test("saveSnapshot stores a manual snapshot with the name", async () => {
  const store = new MemoryStore();
  const id = await saveSnapshot(store, "Before exam");
  expect((await store.getSnapshot(id))).toMatchObject({ kind: "manual", name: "Before exam" });
});
test("auto snapshots are pruned to AUTO_SNAPSHOT_KEEP, manual ones kept", async () => {
  const store = new MemoryStore();
  await saveSnapshot(store, "keep me");
  for (let i = 0; i < AUTO_SNAPSHOT_KEEP + 5; i++) await applyCommand(store, { type: "addTA", name: `T${i}` }, testContext());
  const snaps = await store.listSnapshots();
  expect(snaps.filter(s => s.kind === "auto")).toHaveLength(AUTO_SNAPSHOT_KEEP);
  expect(snaps.filter(s => s.kind === "manual")).toHaveLength(1);
});
test("deleteHistory requires the configured password", async () => {
  const store = new MemoryStore();
  await applyCommand(store, { type: "addTA", name: "A" }, testContext());
  expect(await deleteHistory(store, "nope", "secret")).toBe(false);
  expect(await store.listSnapshots()).toHaveLength(1);
  expect(await deleteHistory(store, "secret", "secret")).toBe(true);
  expect(await store.listSnapshots()).toHaveLength(0);
});
