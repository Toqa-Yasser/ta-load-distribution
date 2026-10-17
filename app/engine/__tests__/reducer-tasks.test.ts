import { reduce, testContext } from "~/engine/reducer";
import { team } from "./fixtures";
import { NotEnoughTAsError, ValidationError, type Command, type Occurrence, type OccurrenceRef, type SeatRef, type Workspace } from "~/engine/types";
const ctx = testContext();
const quiz = (ws: Workspace, n = 8) => reduce(ws, { type: "createTask", kind: "light", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: `2026-10-${String(n).padStart(2, "0")}` } }, ctx);

test("deleteTask refunds only current-turn units", () => {
  const { ws } = team();
  const t1 = quiz(ws, 10);                       // 8 in turn 1, 2 in turn 2
  const t2 = reduce(t1, { type: "createTask", kind: "light", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t2, { type: "deleteTask", taskId: t1.tasks[0].id }, ctx);
  expect(out.tasks.map(t => t.title)).toEqual(["Lab"]);
  const labTa = t2.tasks[1].occurrences[0].seats[0].taId;
  expect(out.ledgers.light.turn).toBe(2);
  expect(Object.values(out.ledgers.light.used).reduce((a, b) => a + b, 0)).toBe(1);   // only Lab's unit remains
  expect(out.ledgers.light.used[labTa]).toBe(1);
});
test("redistributeTask keeps dates and ids but may change TAs; ledger totals unchanged", () => {
  const { ws } = team();
  const t = quiz(ws, 5);
  const out = reduce(t, { type: "redistributeTask", taskId: t.tasks[0].id }, ctx);
  expect(out.tasks[0].occurrences.map(o => o.id)).toEqual(t.tasks[0].occurrences.map(o => o.id));
  expect(out.tasks[0].occurrences.map(o => o.date)).toEqual(t.tasks[0].occurrences.map(o => o.date));
  expect(Object.values(out.ledgers.light.used).reduce((a, b) => a + b, 0)).toBe(5);
});
test("redistributeAll resets the ledger and re-deals in creation order", () => {
  const { ws } = team();
  const t = reduce(quiz(ws, 10), { type: "createTask", kind: "light", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t, { type: "redistributeAll" }, ctx);
  expect(out.ledgers.light.turn).toBe(2);
  expect(Object.values(out.ledgers.light.used).reduce((a, b) => a + b, 0)).toBe(3);  // 11 units = 8 (turn 1) + 3
  expect(out.tasks[0].occurrences.slice(0, 8).every(o => o.seats[0].turn === 1)).toBe(true);
});
test("updateTask with a new schedule refunds and regenerates", () => {
  const { ws } = team();
  const t = quiz(ws, 3);
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, title: "Quiz 2", schedule: { type: "one-time", date: "2026-12-01" } }, ctx);
  expect(out.tasks[0].title).toBe("Quiz 2");
  expect(out.tasks[0].occurrences.map(o => o.date)).toEqual(["2026-12-01"]);
  expect(Object.values(out.ledgers.light.used).reduce((a, b) => a + b, 0)).toBe(1);
});
test("reassignOccurrence moves one unit between TAs", () => {
  const { ws, id } = team();
  const t = quiz(ws, 1);
  const occ = t.tasks[0].occurrences[0];
  const from = occ.seats[0].taId;
  const target = from === id("A") ? id("B") : id("A");
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: occ.id }, from, taId: target }, ctx);
  expect(out.tasks[0].occurrences[0].seats[0].taId).toBe(target);
  expect(out.ledgers.light.used[from] ?? 0).toBe(0);
  expect(out.ledgers.light.used[target]).toBe(1);
});
test("swapOccurrences trades TAs and leaves the ledger alone", () => {
  const { ws } = team();
  const t = quiz(ws, 8);
  const [a, b] = t.tasks[0].occurrences.filter((o, i, arr) => o.seats[0].taId !== arr[0].seats[0].taId || i === 0).slice(0, 2);
  expect(a.seats[0].taId).not.toBe(b.seats[0].taId);
  const ref = (o: Occurrence): SeatRef => ({ taskId: t.tasks[0].id, occurrenceId: o.id, taId: o.seats[0].taId });
  const out = reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(b) }, ctx);
  const find = (id: string) => out.tasks[0].occurrences.find(o => o.id === id)!;
  expect(find(a.id).seats[0].taId).toBe(b.seats[0].taId);
  expect(find(b.id).seats[0].taId).toBe(a.seats[0].taId);
  expect(out.ledgers.light).toEqual(t.ledgers.light);
  expect(() => reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(a) }, ctx)).toThrow(ValidationError);
});
test("swapOccurrences trades turns too, so a later refund hits the right TA", () => {
  const { ws } = team();
  const t = quiz(ws, 10);                        // first 8 in turn 1, last 2 in turn 2
  const occs = t.tasks[0].occurrences;
  const b = occs.find(o => o.seats[0].turn === 2)!;
  const a = occs.find(o => o.seats[0].turn === 1 && o.seats[0].taId !== b.seats[0].taId)!;
  const ref = (o: Occurrence): SeatRef => ({ taskId: t.tasks[0].id, occurrenceId: o.id, taId: o.seats[0].taId });
  const out = reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(b) }, ctx);
  const find = (id: string) => out.tasks[0].occurrences.find(o => o.id === id)!;
  expect(find(a.id).seats[0].turn).toBe(2);
  expect(find(b.id).seats[0].turn).toBe(1);
  const gone = reduce(out, { type: "deleteTask", taskId: t.tasks[0].id }, ctx);
  expect(gone.ledgers.light.turn).toBe(2);
  expect(Object.values(gone.ledgers.light.used).every(n => n === 0)).toBe(true);
});
test("createTask and updateTask reject a schedule with no dates", () => {
  const { ws } = team();
  const empty = { type: "weekly", start: "2027-06-01", end: null } as const;   // after the semester ends
  expect(() => reduce(ws, { type: "createTask", kind: "light", title: "X", schedule: empty }, ctx)).toThrow(new ValidationError("This schedule has no dates."));
  const t = quiz(ws, 2);
  expect(() => reduce(t, { type: "updateTask", taskId: t.tasks[0].id, schedule: empty }, ctx)).toThrow(new ValidationError("This schedule has no dates."));
});
test("updateTask without a schedule changes text only", () => {
  const { ws } = team();
  const t = quiz(ws, 3);
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, title: "Renamed", notes: "Bring pens" }, ctx);
  expect(out.tasks[0]).toEqual({ ...t.tasks[0], title: "Renamed", notes: "Bring pens" });
  expect(out.ledgers).toEqual(t.ledgers);
});
test("updateTask with notes: null clears the notes", () => {
  const { ws } = team();
  const t = reduce(ws, { type: "createTask", kind: "light", title: "Lab", notes: "Room 3", schedule: { type: "one-time", date: "2026-10-01" } }, ctx);
  expect(t.tasks[0].notes).toBe("Room 3");
  const kept = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, title: "Lab 2" }, ctx);
  expect(kept.tasks[0].notes).toBe("Room 3");
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, notes: null }, ctx);
  expect("notes" in out.tasks[0]).toBe(false);
});
test("reassigning to the same TA is a no-op", () => {
  const { ws } = team();
  const t = quiz(ws, 1);
  const occ = t.tasks[0].occurrences[0];
  expect(reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: occ.id }, from: occ.seats[0].taId, taId: occ.seats[0].taId }, ctx)).toBe(t);
});
test("reassigning a past-turn occurrence keeps its turn and leaves the ledger alone", () => {
  const { ws, id } = team();
  const t = quiz(ws, 10);                        // ledger is in turn 2 with two units used
  const old = t.tasks[0].occurrences.find(o => o.seats[0].turn === 1)!;
  const target = [id("A"), id("B"), id("C"), id("D")].find(x => x !== old.seats[0].taId)!;
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: old.id }, from: old.seats[0].taId, taId: target }, ctx);
  expect(out.ledgers.light).toEqual(t.ledgers.light);
  expect(out.tasks[0].occurrences.find(o => o.id === old.id)).toMatchObject({ seats: [{ taId: target, turn: 1 }] });
});
// `used` may carry explicit zeros after a refund; everywhere reads it as `used[id] ?? 0`.
const nonZero = (ledger: Workspace["ledgers"]["light"]) =>
  ({ turn: ledger.turn, used: Object.fromEntries(Object.entries(ledger.used).filter(([, n]) => n > 0)) });
test("reassigning an occurrence away and back restores the ledger (current turn)", () => {
  const { ws, id } = team();
  const t = quiz(ws, 3);
  const occ = t.tasks[0].occurrences[0];
  const target = occ.seats[0].taId === id("A") ? id("B") : id("A");
  const ref: OccurrenceRef = { taskId: t.tasks[0].id, occurrenceId: occ.id };
  const away = reduce(t, { type: "reassignOccurrence", ref, from: occ.seats[0].taId, taId: target }, ctx);
  const back = reduce(away, { type: "reassignOccurrence", ref, from: target, taId: occ.seats[0].taId }, ctx);
  expect(nonZero(back.ledgers.light)).toEqual(nonZero(t.ledgers.light));
  expect(back.tasks[0].occurrences[0]).toEqual(occ);
});
test("reassigning an occurrence away and back restores the ledger (past turn)", () => {
  const { ws, id } = team();
  const t = quiz(ws, 10);
  const old = t.tasks[0].occurrences.find(o => o.seats[0].turn === 1)!;
  const target = [id("A"), id("B"), id("C"), id("D")].find(x => x !== old.seats[0].taId)!;
  const ref: OccurrenceRef = { taskId: t.tasks[0].id, occurrenceId: old.id };
  const away = reduce(t, { type: "reassignOccurrence", ref, from: old.seats[0].taId, taId: target }, ctx);
  const back = reduce(away, { type: "reassignOccurrence", ref, from: target, taId: old.seats[0].taId }, ctx);
  expect(back.ledgers.light).toEqual(t.ledgers.light);
  expect(back.tasks[0].occurrences.find(o => o.id === old.id)).toEqual(old);
});
test("swapOccurrences works across two tasks of the same kind", () => {
  const { ws } = team();
  const t = reduce(quiz(ws, 1), { type: "createTask", kind: "light", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const [q, l] = t.tasks;
  const a = q.occurrences[0], b = l.occurrences[0];
  expect(a.seats[0].taId).not.toBe(b.seats[0].taId);
  const out = reduce(t, { type: "swapOccurrences", a: { taskId: q.id, occurrenceId: a.id, taId: a.seats[0].taId }, b: { taskId: l.id, occurrenceId: b.id, taId: b.seats[0].taId } }, ctx);
  expect(out.tasks[0].occurrences[0]).toEqual({ ...a, seats: [b.seats[0]] });
  expect(out.tasks[1].occurrences[0]).toEqual({ ...b, seats: [a.seats[0]] });
  expect(out.ledgers).toEqual(t.ledgers);
});
test("redistributeAll keeps a task with no occurrences as it is", () => {
  const { ws } = team();
  let t = reduce(ws, { type: "createTask", kind: "light", title: "Early", schedule: { type: "one-time", date: "2026-09-05" } }, ctx);
  t = quiz(t, 3);
  t = reduce(t, { type: "setSemester", semester: { ...t.semester, start: "2026-09-10" } }, ctx);
  expect(t.tasks[0].occurrences).toEqual([]);
  const out = reduce(t, { type: "redistributeAll" }, ctx);
  expect(out.tasks[0]).toEqual(t.tasks[0]);
  expect(Object.values(out.ledgers.light.used).reduce((a, b) => a + b, 0)).toBe(3);
});

// ---- co-staffed dates (taCount) ----
const sum = (ledger: Workspace["ledgers"]["light"]) => Object.values(ledger.used).reduce((a, b) => a + b, 0);
const pair = (ws: Workspace, days: number, taCount = 2) =>
  reduce(ws, { type: "createTask", kind: "light", title: "Pair", taCount, schedule: { type: "daily", start: "2026-10-01", end: `2026-10-${String(days).padStart(2, "0")}` } }, ctx);
const seatIds = (o: Occurrence) => o.seats.map(s => s.taId);

test("createTask with taCount 2 seats two distinct TAs per date and charges both", () => {
  const { ws } = team();
  const out = pair(ws, 4);
  expect(out.tasks[0].taCount).toBe(2);
  for (const o of out.tasks[0].occurrences) {
    expect(o.seats).toHaveLength(2);
    expect(new Set(seatIds(o)).size).toBe(2);
  }
  expect(sum(out.ledgers.light)).toBe(8);
});
test("createTask defaults taCount to 1 and validates it", () => {
  const { ws } = team();
  expect(quiz(ws, 2).tasks[0].taCount).toBe(1);
  for (const bad of [0, -1, 1.5, "2", NaN]) {
    const cmd = { type: "createTask", kind: "light", title: "X", taCount: bad, schedule: { type: "one-time", date: "2026-10-01" } } as unknown as Command;
    expect(() => reduce(ws, cmd, ctx)).toThrow(new ValidationError("TAs per date must be a whole number of at least 1."));
  }
});
test("createTask with taCount above the eligible count throws NotEnoughTAsError and changes nothing", () => {
  const { ws } = team();
  const before = structuredClone(ws);
  const cmd: Command = { type: "createTask", kind: "light", title: "X", taCount: 5, schedule: { type: "one-time", date: "2026-10-01" } };
  expect(() => reduce(ws, cmd, ctx)).toThrow(NotEnoughTAsError);
  expect(() => reduce(ws, cmd, ctx)).toThrow("This task needs 5 TAs but only 4 have sections.");
  expect(ws).toEqual(before);
});
test("updateTask schedule re-deals with the task's taCount", () => {
  const { ws } = team();
  const t = pair(ws, 3);
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, schedule: { type: "one-time", date: "2026-12-01" } }, ctx);
  expect(out.tasks[0].occurrences).toHaveLength(1);
  expect(out.tasks[0].occurrences[0].seats).toHaveLength(2);
  expect(sum(out.ledgers.light)).toBe(2);
});
test("redistributeAll is atomic", () => {
  const { ws } = team();
  const t = quiz(pair(ws, 3), 3);
  let narrow = t;
  for (const s of t.sections.slice(0, 3)) {
    for (const slot of [0, 1] as const) narrow = reduce(narrow, { type: "setSectionSlot", sectionId: s.id, slot, taId: null }, ctx);
  }
  const before = structuredClone(narrow);
  expect(() => reduce(narrow, { type: "redistributeAll" }, ctx)).toThrow(NotEnoughTAsError);
  expect(() => reduce(narrow, { type: "redistributeAll" }, ctx)).toThrow('"Pair" needs 2 TAs on each date but only 1 has sections.');
  expect(narrow).toEqual(before);
});
test("redistributeTask names the task when too few TAs have sections", () => {
  const { ws } = team();
  const t = pair(ws, 3);
  let narrow = t;
  for (const s of t.sections.slice(0, 3)) {
    for (const slot of [0, 1] as const) narrow = reduce(narrow, { type: "setSectionSlot", sectionId: s.id, slot, taId: null }, ctx);
  }
  const before = structuredClone(narrow);
  const cmd: Command = { type: "redistributeTask", taskId: t.tasks[0].id };
  expect(() => reduce(narrow, cmd, ctx)).toThrow(new NotEnoughTAsError(2, 1, "Pair"));
  expect(() => reduce(narrow, cmd, ctx)).toThrow('"Pair" needs 2 TAs on each date but only 1 has sections.');
  expect(narrow).toEqual(before);
});
test("swapOccurrences trades one seat and keeps turns with the seat", () => {
  const { ws } = team();
  const t = pair(ws, 2);
  const [a, b] = t.tasks[0].occurrences;
  const x = a.seats.find(s => !seatIds(b).includes(s.taId))!;
  const y = b.seats.find(s => !seatIds(a).includes(s.taId))!;
  expect(x && y).toBeTruthy();
  const taskId = t.tasks[0].id;
  const out = reduce(t, { type: "swapOccurrences", a: { taskId, occurrenceId: a.id, taId: x.taId }, b: { taskId, occurrenceId: b.id, taId: y.taId } }, ctx);
  const [na, nb] = out.tasks[0].occurrences;
  expect(na.seats).toEqual(a.seats.map(s => (s === x ? y : s)));
  expect(nb.seats).toEqual(b.seats.map(s => (s === y ? x : s)));
  expect(out.ledgers).toEqual(t.ledgers);
});
test("swapOccurrences rejects seating a TA twice", () => {
  const { ws } = team();
  const t = pair(ws, 2);
  const [a, b] = t.tasks[0].occurrences;
  const taskId = t.tasks[0].id;
  // Make b also hold a's first TA by reassigning one of b's seats, then swap that TA in.
  const x = a.seats[0].taId;
  const other = b.seats.find(s => s.taId !== x)!;
  const shared = reduce(t, { type: "reassignOccurrence", ref: { taskId, occurrenceId: b.id }, from: other.taId, taId: x }, ctx);
  const aSeat = shared.tasks[0].occurrences[0].seats.find(s => s.taId !== x)!;
  expect(() => reduce(shared, { type: "swapOccurrences", a: { taskId, occurrenceId: a.id, taId: aSeat.taId }, b: { taskId, occurrenceId: b.id, taId: x } }, ctx))
    .toThrow(new ValidationError("A TA can't hold the same date twice."));
});
test("swapOccurrences same TA is a no-op; unknown seat throws Unknown TA.", () => {
  const { ws } = team();
  const t = quiz(ws, 2);
  const [a, b] = t.tasks[0].occurrences;
  const taskId = t.tasks[0].id;
  const ref = (o: Occurrence, taId = o.seats[0].taId): SeatRef => ({ taskId, occurrenceId: o.id, taId });
  const same = reduce(t, { type: "reassignOccurrence", ref: ref(b), from: b.seats[0].taId, taId: a.seats[0].taId }, ctx);
  expect(reduce(same, { type: "swapOccurrences", a: ref(a), b: ref(same.tasks[0].occurrences[1]) }, ctx)).toBe(same);
  expect(() => reduce(t, { type: "swapOccurrences", a: ref(a, "nope"), b: ref(b) }, ctx)).toThrow(new ValidationError("Unknown TA."));
});
test("reassignOccurrence moves a seat and rejects a duplicate", () => {
  const { ws } = team();
  const t = pair(ws, 1);
  const occ = t.tasks[0].occurrences[0];
  const [x, y] = occ.seats;
  const ref = { taskId: t.tasks[0].id, occurrenceId: occ.id };
  expect(() => reduce(t, { type: "reassignOccurrence", ref, from: x.taId, taId: y.taId }, ctx)).toThrow(new ValidationError("A TA can't hold the same date twice."));
  const z = t.tas.map(a => a.id).find(i => !seatIds(occ).includes(i))!;
  const out = reduce(t, { type: "reassignOccurrence", ref, from: x.taId, taId: z }, ctx);
  expect(out.tasks[0].occurrences[0].seats).toEqual([{ taId: z, turn: x.turn }, y]);
  expect(out.ledgers.light.used[z]).toBe((t.ledgers.light.used[z] ?? 0) + 1);
  expect(out.ledgers.light.used[x.taId]).toBe(t.ledgers.light.used[x.taId] - 1);
});
