import { reduce, describe as describeCmd } from "~/engine/reducer";
import { emptyWorkspace } from "~/engine/empty";
import { capacities } from "~/engine/capacity";
import { ValidationError, NoCapacityError, type Command } from "~/engine/types";
import { ctx, run, team } from "./fixtures";

test("addTA assigns distinct colours and trims the name", () => {
  const ws = run([{ type: "addTA", name: "  Ahmed " }, { type: "addTA", name: "Basma" }]);
  expect(ws.tas.map(t => t.name)).toEqual(["Ahmed", "Basma"]);
  expect(ws.tas[0].color).not.toBe(ws.tas[1].color);
});
test("rejects blank names", () => {
  expect(() => run([{ type: "addTA", name: "   " }])).toThrow(ValidationError);
  expect(() => run([{ type: "addSection", name: "" }])).toThrow(ValidationError);
  expect(() => run([{ type: "addTA", name: "A" }, { type: "createTask", title: " ", schedule: { type: "one-time", date: "2026-10-01" } }])).toThrow(ValidationError);
});
test("sections slots drive capacity", () => {
  const ws = run([{ type: "addTA", name: "A" }, { type: "addSection", name: "S1" }]);
  const [ta] = ws.tas; const [sec] = ws.sections;
  const ws2 = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 0, taId: ta.id }, ctx);
  expect(capacities(ws2)[ta.id]).toBe(1);
  expect(capacities(reduce(ws2, { type: "removeSection", sectionId: sec.id }, ctx))[ta.id]).toBe(0);
});
test("createTask generates and assigns occurrences, advancing the ledger", () => {
  const { ws } = team();
  const out = reduce(ws, { type: "createTask", title: "Quiz", schedule: { type: "weekly", start: "2026-10-01", end: "2026-10-22" } }, ctx);
  expect(out.tasks[0].occurrences).toHaveLength(4);
  expect(out.tasks[0].createdAt).toBe("2026-10-16T12:00:00.000Z");
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(4);
});
test("createTask with no sections throws NoCapacityError", () => {
  const ws = run([{ type: "addTA", name: "A" }]);
  expect(() => reduce(ws, { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } }, ctx)).toThrow(NoCapacityError);
});
test("removeTA re-assigns its occurrences to the others", () => {
  const { ws, id } = team();
  const withTask = reduce(ws, { type: "createTask", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: "2026-10-08" } }, ctx);
  const out = reduce(withTask, { type: "removeTA", taId: id("D") }, ctx);
  expect(out.tas.map(t => t.name)).toEqual(["A", "B", "C"]);
  expect(out.sections.every(s => !s.taIds.includes(id("D")))).toBe(true);
  expect(out.tasks[0].occurrences).toHaveLength(8);
  expect(out.tasks[0].occurrences.every(o => o.taId !== id("D"))).toBe(true);
  expect(out.ledger.used[id("D")]).toBeUndefined();
});
test("removeTA throws NoCapacityError and leaves workspace unchanged when nobody else has capacity", () => {
  const ws0 = run([{ type: "addTA", name: "A" }, { type: "addTA", name: "B" }, { type: "addSection", name: "S" }]);
  const ws = reduce(ws0, { type: "setSectionSlot", sectionId: ws0.sections[0].id, slot: 0, taId: ws0.tas[0].id }, ctx);
  const withTask = reduce(ws, { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } }, ctx);
  expect(() => reduce(withTask, { type: "removeTA", taId: ws.tas[0].id }, ctx)).toThrow(NoCapacityError);
});
test("setSemester with end before start is rejected; shrinking end truncates occurrences", () => {
  const { ws } = team();
  expect(() => reduce(ws, { type: "setSemester", semester: { name: "x", start: "2026-10-10", end: "2026-10-01" } }, ctx)).toThrow(ValidationError);
  const t = reduce(ws, { type: "createTask", title: "Q", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  const cut = reduce(t, { type: "setSemester", semester: { ...t.semester, end: "2026-10-20" } }, ctx);
  expect(cut.tasks[0].occurrences.map(o => o.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
});
test("reset returns the empty workspace", () => {
  const { ws } = team();
  expect(reduce(ws, { type: "reset" }, ctx)).toEqual(emptyWorkspace());
});
test("reduce never mutates its input", () => {
  const ws = emptyWorkspace(); const frozen = JSON.stringify(ws);
  reduce(ws, { type: "addTA", name: "A" }, ctx);
  expect(JSON.stringify(ws)).toBe(frozen);
});
test("describe produces human labels", () => {
  const ws = run([{ type: "addTA", name: "Ahmed" }]);
  expect(describeCmd({ type: "addTA", name: "Ahmed" }, ws)).toBe('Added TA "Ahmed"');
  expect(describeCmd({ type: "removeTA", taId: ws.tas[0].id }, ws)).toBe('Removed TA "Ahmed"');
  expect(describeCmd({ type: "reset" }, ws)).toBe("Reset everything");
});
