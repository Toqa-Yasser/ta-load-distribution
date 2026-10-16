import { reduce, testContext } from "~/engine/reducer";
import { team } from "./fixtures";
import { ValidationError, type Occurrence, type OccurrenceRef, type Workspace } from "~/engine/types";
const ctx = testContext();
const quiz = (ws: Workspace, n = 8) => reduce(ws, { type: "createTask", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: `2026-10-${String(n).padStart(2, "0")}` } }, ctx);

test("deleteTask refunds only current-turn units", () => {
  const { ws } = team();
  const t1 = quiz(ws, 10);                       // 8 in turn 1, 2 in turn 2
  const t2 = reduce(t1, { type: "createTask", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t2, { type: "deleteTask", taskId: t1.tasks[0].id }, ctx);
  expect(out.tasks.map(t => t.title)).toEqual(["Lab"]);
  const labTa = t2.tasks[1].occurrences[0].taId;
  expect(out.ledger.turn).toBe(2);
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(1);   // only Lab's unit remains
  expect(out.ledger.used[labTa]).toBe(1);
});
test("redistributeTask keeps dates and ids but may change TAs; ledger totals unchanged", () => {
  const { ws } = team();
  const t = quiz(ws, 5);
  const out = reduce(t, { type: "redistributeTask", taskId: t.tasks[0].id }, ctx);
  expect(out.tasks[0].occurrences.map(o => o.id)).toEqual(t.tasks[0].occurrences.map(o => o.id));
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(5);
});
test("redistributeAll resets the ledger and re-deals in creation order", () => {
  const { ws } = team();
  const t = reduce(quiz(ws, 10), { type: "createTask", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t, { type: "redistributeAll" }, ctx);
  expect(out.ledger.turn).toBe(2);
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(3);  // 11 units = 8 (turn 1) + 3
  expect(out.tasks[0].occurrences.slice(0, 8).every(o => o.turn === 1)).toBe(true);
});
test("updateTask with a new schedule refunds and regenerates", () => {
  const { ws } = team();
  const t = quiz(ws, 3);
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, title: "Quiz 2", schedule: { type: "one-time", date: "2026-12-01" } }, ctx);
  expect(out.tasks[0].title).toBe("Quiz 2");
  expect(out.tasks[0].occurrences.map(o => o.date)).toEqual(["2026-12-01"]);
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(1);
});
test("reassignOccurrence moves one unit between TAs", () => {
  const { ws, id } = team();
  const t = quiz(ws, 1);
  const occ = t.tasks[0].occurrences[0];
  const target = occ.taId === id("A") ? id("B") : id("A");
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: occ.id }, taId: target }, ctx);
  expect(out.tasks[0].occurrences[0].taId).toBe(target);
  expect(out.ledger.used[occ.taId] ?? 0).toBe(0);
  expect(out.ledger.used[target]).toBe(1);
});
test("swapOccurrences trades TAs and leaves the ledger alone", () => {
  const { ws } = team();
  const t = quiz(ws, 8);
  const [a, b] = t.tasks[0].occurrences.filter((o, i, arr) => o.taId !== arr[0].taId || i === 0).slice(0, 2);
  const ref = (o: Occurrence): OccurrenceRef => ({ taskId: t.tasks[0].id, occurrenceId: o.id });
  const out = reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(b) }, ctx);
  const find = (id: string) => out.tasks[0].occurrences.find(o => o.id === id)!;
  expect(find(a.id).taId).toBe(b.taId);
  expect(find(b.id).taId).toBe(a.taId);
  expect(out.ledger).toEqual(t.ledger);
  expect(() => reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(a) }, ctx)).toThrow(ValidationError);
});
