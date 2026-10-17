import { reduce, testContext } from "~/engine/reducer";
import { team } from "./fixtures";
import { ValidationError, type Occurrence, type OccurrenceRef, type Workspace } from "~/engine/types";
const ctx = testContext();
const quiz = (ws: Workspace, n = 8) => reduce(ws, { type: "createTask", kind: "light", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: `2026-10-${String(n).padStart(2, "0")}` } }, ctx);

test("deleteTask refunds only current-turn units", () => {
  const { ws } = team();
  const t1 = quiz(ws, 10);                       // 8 in turn 1, 2 in turn 2
  const t2 = reduce(t1, { type: "createTask", kind: "light", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t2, { type: "deleteTask", taskId: t1.tasks[0].id }, ctx);
  expect(out.tasks.map(t => t.title)).toEqual(["Lab"]);
  const labTa = t2.tasks[1].occurrences[0].taId;
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
  expect(out.tasks[0].occurrences.slice(0, 8).every(o => o.turn === 1)).toBe(true);
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
  const target = occ.taId === id("A") ? id("B") : id("A");
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: occ.id }, taId: target }, ctx);
  expect(out.tasks[0].occurrences[0].taId).toBe(target);
  expect(out.ledgers.light.used[occ.taId] ?? 0).toBe(0);
  expect(out.ledgers.light.used[target]).toBe(1);
});
test("swapOccurrences trades TAs and leaves the ledger alone", () => {
  const { ws } = team();
  const t = quiz(ws, 8);
  const [a, b] = t.tasks[0].occurrences.filter((o, i, arr) => o.taId !== arr[0].taId || i === 0).slice(0, 2);
  expect(a.taId).not.toBe(b.taId);
  const ref = (o: Occurrence): OccurrenceRef => ({ taskId: t.tasks[0].id, occurrenceId: o.id });
  const out = reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(b) }, ctx);
  const find = (id: string) => out.tasks[0].occurrences.find(o => o.id === id)!;
  expect(find(a.id).taId).toBe(b.taId);
  expect(find(b.id).taId).toBe(a.taId);
  expect(out.ledgers.light).toEqual(t.ledgers.light);
  expect(() => reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(a) }, ctx)).toThrow(ValidationError);
});
test("swapOccurrences trades turns too, so a later refund hits the right TA", () => {
  const { ws } = team();
  const t = quiz(ws, 10);                        // first 8 in turn 1, last 2 in turn 2
  const occs = t.tasks[0].occurrences;
  const b = occs.find(o => o.turn === 2)!;
  const a = occs.find(o => o.turn === 1 && o.taId !== b.taId)!;
  const ref = (o: Occurrence): OccurrenceRef => ({ taskId: t.tasks[0].id, occurrenceId: o.id });
  const out = reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(b) }, ctx);
  const find = (id: string) => out.tasks[0].occurrences.find(o => o.id === id)!;
  expect(find(a.id).turn).toBe(2);
  expect(find(b.id).turn).toBe(1);
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
  expect(reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: occ.id }, taId: occ.taId }, ctx)).toBe(t);
});
test("reassigning a past-turn occurrence keeps its turn and leaves the ledger alone", () => {
  const { ws, id } = team();
  const t = quiz(ws, 10);                        // ledger is in turn 2 with two units used
  const old = t.tasks[0].occurrences.find(o => o.turn === 1)!;
  const target = [id("A"), id("B"), id("C"), id("D")].find(x => x !== old.taId)!;
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: old.id }, taId: target }, ctx);
  expect(out.ledgers.light).toEqual(t.ledgers.light);
  expect(out.tasks[0].occurrences.find(o => o.id === old.id)).toMatchObject({ taId: target, turn: 1 });
});
// `used` may carry explicit zeros after a refund; everywhere reads it as `used[id] ?? 0`.
const nonZero = (ledger: Workspace["ledgers"]["light"]) =>
  ({ turn: ledger.turn, used: Object.fromEntries(Object.entries(ledger.used).filter(([, n]) => n > 0)) });
test("reassigning an occurrence away and back restores the ledger (current turn)", () => {
  const { ws, id } = team();
  const t = quiz(ws, 3);
  const occ = t.tasks[0].occurrences[0];
  const target = occ.taId === id("A") ? id("B") : id("A");
  const ref: OccurrenceRef = { taskId: t.tasks[0].id, occurrenceId: occ.id };
  const away = reduce(t, { type: "reassignOccurrence", ref, taId: target }, ctx);
  const back = reduce(away, { type: "reassignOccurrence", ref, taId: occ.taId }, ctx);
  expect(nonZero(back.ledgers.light)).toEqual(nonZero(t.ledgers.light));
  expect(back.tasks[0].occurrences[0]).toEqual(occ);
});
test("reassigning an occurrence away and back restores the ledger (past turn)", () => {
  const { ws, id } = team();
  const t = quiz(ws, 10);
  const old = t.tasks[0].occurrences.find(o => o.turn === 1)!;
  const target = [id("A"), id("B"), id("C"), id("D")].find(x => x !== old.taId)!;
  const ref: OccurrenceRef = { taskId: t.tasks[0].id, occurrenceId: old.id };
  const away = reduce(t, { type: "reassignOccurrence", ref, taId: target }, ctx);
  const back = reduce(away, { type: "reassignOccurrence", ref, taId: old.taId }, ctx);
  expect(back.ledgers.light).toEqual(t.ledgers.light);
  expect(back.tasks[0].occurrences.find(o => o.id === old.id)).toEqual(old);
});
test("swapOccurrences works across two tasks of the same kind", () => {
  const { ws } = team();
  const t = reduce(quiz(ws, 1), { type: "createTask", kind: "light", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const [q, l] = t.tasks;
  const a = q.occurrences[0], b = l.occurrences[0];
  expect(a.taId).not.toBe(b.taId);
  const out = reduce(t, { type: "swapOccurrences", a: { taskId: q.id, occurrenceId: a.id }, b: { taskId: l.id, occurrenceId: b.id } }, ctx);
  expect(out.tasks[0].occurrences[0]).toEqual({ ...a, taId: b.taId, turn: b.turn });
  expect(out.tasks[1].occurrences[0]).toEqual({ ...b, taId: a.taId, turn: a.turn });
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
