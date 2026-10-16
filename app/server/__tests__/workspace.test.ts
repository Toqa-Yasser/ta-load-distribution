import { MemoryStore } from "~/server/memory-store";
import { applyCommand, commandSeed, loadWorkspace, previewCommand, rollback, saveSnapshot, deleteHistory, AUTO_SNAPSHOT_KEEP } from "~/server/workspace.server";
import { testContext } from "~/engine/reducer";
import { EngineError, ValidationError, type Command, type Workspace } from "~/engine/types";
import { HookedMemoryStore } from "./hooked-memory-store";

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
  const store = new HookedMemoryStore(async (s) => { if (!fired) { fired = true; await s.putWorkspace({ ...(await s.getWorkspace())!.data, semester: { name: "X", start: "2026-01-01", end: "2026-12-31" } }, 1); } });
  const r = await applyCommand(store, { type: "addTA", name: "Ahmed" }, testContext());
  expect(r.version).toBe(3);
  expect(r.workspace.semester.name).toBe("X");       // built on the newer document
  expect(r.workspace.tas[0].name).toBe("Ahmed");
});
test("applyCommand gives up after three conflicts", async () => {
  const store = new HookedMemoryStore(async (s) => { const w = (await s.getWorkspace())!; await s.putWorkspace(w.data, w.version); });
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
    const cmd: Command = { type: "createTask", kind: "light", title: `Task ${start}`, schedule: { type: "weekly", start, end: "2026-12-31" } };
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

/** A v1.0 document: one `ledger`, tasks without a `kind`. */
function legacyDoc() {
  return {
    semester: { name: "Fall", start: "2026-09-01", end: "2027-01-31" },
    tas: [{ id: "ta_1", name: "A", color: "#f26b5b" }],
    sections: [{ id: "sec_1", name: "S1", taIds: ["ta_1", null] }],
    tasks: [{
      id: "task_1", title: "Quiz", createdAt: "2026-10-01T00:00:00.000Z",
      schedule: { type: "one-time", date: "2026-10-05" },
      occurrences: [{ id: "occ_1", date: "2026-10-05", taId: "ta_1", turn: 1 }],
    }],
    ledger: { turn: 1, used: { ta_1: 1 } },
  };
}
const asStored = (doc: unknown) => doc as Workspace;

test("legacy document upgrades on load and is written back once", async () => {
  const store = new MemoryStore();
  await store.putWorkspace(asStored(legacyDoc()), null);
  const put = vi.spyOn(store, "putWorkspace");

  const first = await loadWorkspace(store);
  expect(first.version).toBe(2);
  expect(first.data.ledgers).toEqual({ light: { turn: 1, used: { ta_1: 1 } }, heavy: { turn: 1, used: {} } });
  expect(first.data.tasks[0].kind).toBe("light");
  expect("ledger" in first.data).toBe(false);
  expect(await store.getWorkspace()).toEqual(first);
  const snaps = await store.listSnapshots();
  expect(snaps).toHaveLength(1);
  expect(snaps[0]).toMatchObject({ kind: "auto", label: "Upgraded to task kinds", version: 1, name: null });
  expect((await store.getSnapshot(snaps[0].id))!.data).toEqual(legacyDoc());

  const second = await loadWorkspace(store);
  expect(second).toEqual(first);
  expect(put).toHaveBeenCalledTimes(1);
  expect(await store.listSnapshots()).toHaveLength(1);
});

test("an upgrade that loses a version race re-reads the winner's document", async () => {
  let fired = false;
  const store = new HookedMemoryStore(async (s) => {
    if (fired) return;
    fired = true;
    // Another instance upgrades first.
    const w = (await s.getWorkspace())!;
    const { ledger, ...rest } = w.data as unknown as ReturnType<typeof legacyDoc>;
    await s.putWorkspace(asStored({ ...rest, semester: { ...rest.semester, name: "Winner" }, tasks: rest.tasks.map((t) => ({ ...t, kind: "light" })), ledgers: { light: ledger, heavy: { turn: 1, used: {} } } }), w.version);
  });
  await store.putWorkspace(asStored(legacyDoc()), null);
  const row = await loadWorkspace(store);
  expect(row.version).toBe(2);
  expect(row.data.semester.name).toBe("Winner");
  expect(await store.listSnapshots()).toHaveLength(0); // the loser leaves no orphan snapshot
});

test("loadWorkspace rejects an unrecognised document with a clear error", async () => {
  const store = new MemoryStore();
  await store.putWorkspace(asStored({ hello: "world" }), null);
  await expect(loadWorkspace(store)).rejects.toThrow(new ValidationError("Unrecognised workspace document."));
});

test("commands run on the upgraded document", async () => {
  const store = new MemoryStore();
  await store.putWorkspace(asStored(legacyDoc()), null);
  const preview = await previewCommand(store, { type: "addTA", name: "B" }, testContext());
  expect(preview.ledgers.light).toEqual({ turn: 1, used: { ta_1: 1 } });
  const r = await applyCommand(store, { type: "addTA", name: "B" }, testContext());
  expect(r.version).toBe(3); // 1 legacy → 2 upgraded → 3 with the TA
  expect(r.workspace.tas.map((t) => t.name)).toEqual(["A", "B"]);
  expect((await store.listSnapshots()).map((s) => s.label)).toEqual(['Added TA "B"', "Upgraded to task kinds"]);
});

test("rollback upgrades a legacy snapshot", async () => {
  const store = new MemoryStore();
  await loadWorkspace(store);
  const id = await store.insertSnapshot({ name: "v1.0", label: 'Snapshot "v1.0"', kind: "manual", version: 1, data: asStored(legacyDoc()) });
  const r = await rollback(store, id);
  expect(r.workspace.ledgers.light).toEqual({ turn: 1, used: { ta_1: 1 } });
  expect(r.workspace.tasks[0].kind).toBe("light");
  expect("ledger" in r.workspace).toBe(false);
  const stored = (await store.getWorkspace())!;
  expect(stored.data).toEqual(r.workspace);
  expect("ledger" in stored.data).toBe(false);
});

test("applyCommand returns label from the loaded document", async () => {
  const store = new MemoryStore();
  const { workspace } = await applyCommand(store, { type: "addTA", name: "Ahmed" }, testContext());
  const added = await applyCommand(store, { type: "addTA", name: "Mona" }, testContext());
  expect(added.label).toBe('Added TA "Mona"');
  // The removed TA's name only exists in the document before the command.
  const removed = await applyCommand(store, { type: "removeTA", taId: workspace.tas[0].id }, testContext());
  expect(removed.label).toBe('Removed TA "Ahmed"');
  expect((await store.listSnapshots())[0].label).toBe('Removed TA "Ahmed"');
});

test("rollback retries on version conflict", async () => {
  let armed = false;
  let fired = false;
  const store = new HookedMemoryStore(async (s) => {
    if (!armed || fired) return;
    fired = true;
    const w = (await s.getWorkspace())!;
    await s.putWorkspace({ ...w.data, semester: { name: "X", start: "2026-01-01", end: "2026-12-31" } }, w.version);
  });
  await applyCommand(store, { type: "addTA", name: "A" }, testContext());
  const [snap] = await store.listSnapshots();
  armed = true;
  const r = await rollback(store, snap.id);
  expect(fired).toBe(true);
  expect(r.version).toBe(4); // 2 after addTA, 3 from the interloper, 4 from the rollback
  expect(r.workspace.tas).toEqual([]);
  expect((await store.getWorkspace())!.version).toBe(4);
});

test("rollback gives up after three conflicts", async () => {
  let armed = false;
  const store = new HookedMemoryStore(async (s) => { if (!armed) return; const w = (await s.getWorkspace())!; await s.putWorkspace(w.data, w.version); });
  await applyCommand(store, { type: "addTA", name: "A" }, testContext());
  const [snap] = await store.listSnapshots();
  armed = true;
  await expect(rollback(store, snap.id)).rejects.toMatchObject({ code: "CONFLICT" });
});

test("saveSnapshot rejects a blank name", async () => {
  const store = new MemoryStore();
  for (const name of ["", "   "]) await expect(saveSnapshot(store, name)).rejects.toBeInstanceOf(ValidationError);
  expect(await store.listSnapshots()).toHaveLength(0);
});

test("loadWorkspace create race returns the winner", async () => {
  const store = new MemoryStore();
  const winner = { ...(await loadWorkspace(new MemoryStore())).data, semester: { name: "Winner", start: "2026-09-01", end: "2027-01-31" } };
  await store.putWorkspace(winner, null);
  // Our first read happened before the winner's insert landed.
  vi.spyOn(store, "getWorkspace").mockResolvedValueOnce(null);
  const row = await loadWorkspace(store);
  expect(row).toEqual({ data: winner, version: 1 });
});
