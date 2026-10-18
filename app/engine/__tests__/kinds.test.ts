import { reduce, describe as describeCmd } from "~/engine/reducer";
import { emptyWorkspace } from "~/engine/empty";
import { LOAD_KINDS, TASK_KINDS, ValidationError, isLoadKind, type Command, type Ledger, type Occurrence, type SeatRef, type TaskKind, type Workspace } from "~/engine/types";
import { ctx, team } from "./fixtures";

const total = (l: Ledger) => Object.values(l.used).reduce((a, b) => a + b, 0);
const fresh: Ledger = { turn: 1, used: {} };

function daily(ws: Workspace, kind: TaskKind, days: number, title: string = kind): Workspace {
  const end = `2026-10-${String(days).padStart(2, "0")}`;
  return reduce(ws, { type: "createTask", kind, title, schedule: { type: "daily", start: "2026-10-01", end } }, ctx);
}

function byName(ws: Workspace, used: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(used)) out[ws.tas.find((t) => t.id === id)?.name ?? id] = n;
  return out;
}

const ref = (taskId: string, o: Occurrence): SeatRef => ({ taskId, occurrenceId: o.id, taId: o.seats[0].taId });

test("TASK_KINDS adds equal after the load kinds; empty workspace has two fresh ledgers", () => {
  expect(TASK_KINDS).toEqual(["light", "heavy", "equal"]);
  expect(LOAD_KINDS).toEqual(["light", "heavy"]);
  expect(emptyWorkspace().ledgers).toEqual({ light: fresh, heavy: fresh });
  expect(isLoadKind("equal")).toBe(false);
});

test('createTask kind:"heavy" charges only ledgers.heavy', () => {
  const { ws } = team();
  const out = daily(ws, "heavy", 3);
  expect(out.tasks[0].kind).toBe("heavy");
  expect(total(out.ledgers.heavy)).toBe(3);
  expect(out.ledgers.light).toEqual(fresh);
});

test("createTask stores light kind and rejects an unknown kind", () => {
  const { ws } = team();
  expect(daily(ws, "light", 1).tasks[0].kind).toBe("light");
  const bad = { type: "createTask", kind: "medium", title: "X", schedule: { type: "one-time", date: "2026-10-01" } } as unknown as Command;
  expect(() => reduce(ws, bad, ctx)).toThrow(new ValidationError("Invalid task kind."));
  const missing = { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } } as unknown as Command;
  expect(() => reduce(ws, missing, ctx)).toThrow(new ValidationError("Invalid task kind."));
});

test("light and heavy turns advance independently", () => {
  const { ws } = team();
  const out = daily(daily(ws, "heavy", 8), "light", 8);
  for (const kind of TASK_KINDS) {
    expect(out.ledgers[kind].turn).toBe(1);
    expect(byName(out, out.ledgers[kind].used)).toEqual({ A: 1, B: 2, C: 2, D: 3 });
  }
});

test("swap across kinds throws", () => {
  const { ws } = team();
  const t = daily(daily(ws, "light", 2), "heavy", 2);
  const [light, heavy] = t.tasks;
  const cmd: Command = { type: "swapOccurrences", a: ref(light.id, light.occurrences[0]), b: ref(heavy.id, heavy.occurrences[0]) };
  expect(() => reduce(t, cmd, ctx)).toThrow(new ValidationError("Only tasks of the same kind can be swapped."));
});

test("removeTA re-deals each kind on its own ledger", () => {
  const { ws, id } = team();
  const t = daily(daily(ws, "light", 8), "heavy", 3);
  const out = reduce(t, { type: "removeTA", taId: id("D") }, ctx);
  expect(out.tasks.flatMap((x) => x.occurrences).every((o) => o.seats[0].taId !== id("D"))).toBe(true);
  // Light: D's three turn-1 units are refunded; A1 B2 C2 are already full, so they land in turn 2.
  expect(out.ledgers.light.turn).toBe(2);
  expect(total(out.ledgers.light)).toBe(3);
  // Heavy: re-dealt within its own turn 1, total unchanged.
  expect(out.ledgers.heavy.turn).toBe(1);
  expect(total(out.ledgers.heavy)).toBe(3);
  for (const kind of TASK_KINDS) expect(out.ledgers[kind].used[id("D")]).toBeUndefined();
});

test("redistributeAll resets both ledgers and re-deals light then heavy", () => {
  const { ws } = team();
  let t = daily(ws, "heavy", 3, "H");
  t = daily(t, "light", 10, "L");
  const polluted: Workspace = { ...t, ledgers: { light: { turn: 9, used: { x: 4 } }, heavy: { turn: 7, used: { y: 2 } } } };
  const out = reduce(polluted, { type: "redistributeAll" }, ctx);
  expect(out.ledgers.light.turn).toBe(2);
  expect(total(out.ledgers.light)).toBe(2);
  expect(out.ledgers.heavy.turn).toBe(1);
  expect(total(out.ledgers.heavy)).toBe(3);
  expect(out.tasks.map((x) => x.title)).toEqual(["H", "L"]);
  const light = out.tasks[1].occurrences;
  expect(light.slice(0, 8).every((o) => o.seats[0].turn === 1)).toBe(true);
  expect(light.slice(8).every((o) => o.seats[0].turn === 2)).toBe(true);
});

test("setSemester extension charges the task's own kind", () => {
  const { ws: base } = team();
  let ws = reduce(base, { type: "setSemester", semester: { name: "F", start: "2026-10-01", end: "2026-10-21" } }, ctx);
  ws = reduce(ws, { type: "createTask", kind: "heavy", title: "H", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  ws = reduce(ws, { type: "createTask", kind: "light", title: "L", schedule: { type: "one-time", date: "2026-10-05" } }, ctx);
  const out = reduce(ws, { type: "setSemester", semester: { name: "F", start: "2026-10-01", end: "2026-11-05" } }, ctx);
  expect(out.tasks[0].occurrences).toHaveLength(6);
  expect(total(out.ledgers.heavy)).toBe(6);
  expect(out.ledgers.light).toEqual(ws.ledgers.light);
});

test("setSemester truncation refunds the task's own kind", () => {
  const { ws: base } = team();
  let ws = reduce(base, { type: "setSemester", semester: { name: "F", start: "2026-10-01", end: "2026-10-31" } }, ctx);
  ws = reduce(ws, { type: "createTask", kind: "heavy", title: "H", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  ws = reduce(ws, { type: "createTask", kind: "light", title: "L", schedule: { type: "one-time", date: "2026-10-02" } }, ctx);
  const out = reduce(ws, { type: "setSemester", semester: { name: "F", start: "2026-10-01", end: "2026-10-10" } }, ctx);
  expect(total(out.ledgers.heavy)).toBe(2);
  expect(out.ledgers.light).toEqual(ws.ledgers.light);
});

test("deleteTask refunds the task's kind only", () => {
  const { ws } = team();
  const t = daily(daily(ws, "light", 4), "heavy", 2);
  const out = reduce(t, { type: "deleteTask", taskId: t.tasks[1].id }, ctx);
  expect(total(out.ledgers.heavy)).toBe(0);
  expect(out.ledgers.light).toEqual(t.ledgers.light);
});

test("updateTask, redistributeTask and reassignOccurrence touch only their kind's ledger", () => {
  const { ws, id } = team();
  const t = daily(daily(ws, "light", 4), "heavy", 2);
  const heavy = t.tasks[1];

  const updated = reduce(t, { type: "updateTask", taskId: heavy.id, schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  expect(updated.tasks[1].kind).toBe("heavy");
  expect(total(updated.ledgers.heavy)).toBe(1);
  expect(updated.ledgers.light).toEqual(t.ledgers.light);

  const redealt = reduce(t, { type: "redistributeTask", taskId: heavy.id }, ctx);
  expect(total(redealt.ledgers.heavy)).toBe(2);
  expect(redealt.ledgers.light).toEqual(t.ledgers.light);

  const occ = heavy.occurrences[0];
  const from = occ.seats[0].taId;
  const target = from === id("A") ? id("B") : id("A");
  const moved = reduce(t, { type: "reassignOccurrence", ref: { taskId: heavy.id, occurrenceId: occ.id }, from, taId: target }, ctx);
  expect(moved.ledgers.heavy.used[target]).toBe((t.ledgers.heavy.used[target] ?? 0) + 1);
  expect(moved.ledgers.heavy.used[from] ?? 0).toBe((t.ledgers.heavy.used[from] ?? 0) - 1);
  expect(moved.ledgers.light).toEqual(t.ledgers.light);
});

test("describe names the kind for createTask", () => {
  const ws = emptyWorkspace();
  const schedule = { type: "one-time", date: "2026-10-01" } as const;
  expect(describeCmd({ type: "createTask", kind: "light", title: " Quiz ", schedule }, ws)).toBe('Added light task "Quiz"');
  expect(describeCmd({ type: "createTask", kind: "heavy", title: "Exam", schedule }, ws)).toBe('Added heavy task "Exam"');
});
