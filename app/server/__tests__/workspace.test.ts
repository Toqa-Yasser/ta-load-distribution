import { MemoryStore } from "~/server/memory-store";
import { applyCommand, commandSeed, loadWorkspace, previewCommand, rollback, saveSnapshot, deleteHistory, AUTO_SNAPSHOT_KEEP } from "~/server/workspace.server";
import { testContext } from "~/engine/reducer";
import { EngineError, type Command } from "~/engine/types";

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

test("preview and apply assign the same TAs for the same version and command", async () => {
  const store = new MemoryStore();
  for (const name of ["A", "B", "C", "D"]) await applyCommand(store, { type: "addTA", name });
  for (const name of ["S1", "S2", "S3", "S4"]) await applyCommand(store, { type: "addSection", name });
  const { data } = await loadWorkspace(store);
  const ta = Object.fromEntries(data.tas.map((t) => [t.name, t.id]));
  const layout: [number, string, string][] = [[0, "A", "B"], [1, "B", "C"], [2, "C", "D"], [3, "D", "D"]];
  for (const [i, x, y] of layout) {
    await applyCommand(store, { type: "setSectionSlot", sectionId: data.sections[i].id, slot: 0, taId: ta[x] });
    await applyCommand(store, { type: "setSectionSlot", sectionId: data.sections[i].id, slot: 1, taId: ta[y] });
  }
  // Several commands so a Math.random-based context would almost surely diverge somewhere.
  for (const start of ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]) {
    const cmd: Command = { type: "createTask", title: `Task ${start}`, schedule: { type: "weekly", start, end: "2026-12-31" } };
    const previewed = await previewCommand(store, cmd);
    const applied = (await applyCommand(store, cmd)).workspace;
    const taIds = (ws: typeof previewed) => ws.tasks[ws.tasks.length - 1].occurrences.map((o) => o.taId);
    expect(taIds(applied)).toEqual(taIds(previewed));
  }
});
test("commandSeed is stable for the same version and command and differs otherwise", () => {
  const a: Command = { type: "addTA", name: "A" };
  const b: Command = { type: "addTA", name: "B" };
  expect(commandSeed(5, a)).toBe(commandSeed(5, a));
  expect(commandSeed(5, a)).not.toBe(commandSeed(5, b));
  expect(commandSeed(5, a)).not.toBe(commandSeed(6, a));
});
