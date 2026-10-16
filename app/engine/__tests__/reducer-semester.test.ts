import { reduce } from "~/engine/reducer";
import type { Workspace } from "~/engine/types";
import { ctx, team } from "./fixtures";

const total = (ws: Workspace) => Object.values(ws.ledgers.light.used).reduce((a, b) => a + b, 0);

function withSemester(ws: Workspace, start: string, end: string): Workspace {
  return reduce(ws, { type: "setSemester", semester: { name: "Fall", start, end } }, ctx);
}

test("extending the end adds assigned dates to open-ended tasks only", () => {
  const { ws: base } = team();
  let ws = withSemester(base, "2026-10-01", "2026-10-21");
  ws = reduce(ws, { type: "createTask", kind: "light", title: "Open", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  ws = reduce(ws, { type: "createTask", kind: "light", title: "Once", schedule: { type: "one-time", date: "2026-10-05" } }, ctx);
  const before = ws.tasks[0].occurrences;
  expect(before.map((o) => o.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
  const usedBefore = total(ws);

  const out = withSemester(ws, "2026-10-01", "2026-11-05");
  const occ = out.tasks[0].occurrences;
  expect(occ.map((o) => o.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05"]);
  // Existing assignments are untouched.
  expect(occ.slice(0, 3)).toEqual(before);
  // New ones are assigned to real TAs.
  const taIds = new Set(out.tas.map((t) => t.id));
  expect(occ.slice(3).every((o) => taIds.has(o.taId) && o.turn >= 1 && o.id)).toBe(true);
  expect(new Set(occ.map((o) => o.id)).size).toBe(6);
  // The one-time task is unchanged.
  expect(out.tasks[1]).toEqual(ws.tasks[1]);
  // Ledger threaded: 3 more deals were counted (within the same or a later turn).
  expect(out.ledgers.light.turn > ws.ledgers.light.turn || total(out) === usedBefore + 3).toBe(true);
});

test("fixed-end tasks are not extended", () => {
  const { ws: base } = team();
  let ws = withSemester(base, "2026-10-01", "2026-10-21");
  ws = reduce(ws, { type: "createTask", kind: "light", title: "Fixed", schedule: { type: "daily", start: "2026-10-01", end: "2026-10-05" } }, ctx);
  const out = withSemester(ws, "2026-10-01", "2026-12-31");
  expect(out.tasks[0].occurrences).toEqual(ws.tasks[0].occurrences);
  expect(out.ledgers.light).toEqual(ws.ledgers.light);
});

test("moving start later drops and refunds earlier occurrences", () => {
  const { ws: base } = team();
  let ws = withSemester(base, "2026-10-01", "2026-10-31");
  ws = reduce(ws, { type: "createTask", kind: "light", title: "Q", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  expect(ws.tasks[0].occurrences).toHaveLength(5);
  const usedBefore = total(ws);
  const out = withSemester(ws, "2026-10-10", "2026-10-31");
  expect(out.tasks[0].occurrences.map((o) => o.date)).toEqual(["2026-10-15", "2026-10-22", "2026-10-29"]);
  expect(out.tasks[0].occurrences).toEqual(ws.tasks[0].occurrences.slice(2));
  expect(total(out)).toBe(usedBefore - 2);
});

test("shrinking the end refunds the dropped current-turn units", () => {
  const { ws: base } = team();
  let ws = withSemester(base, "2026-10-01", "2026-10-31");
  ws = reduce(ws, { type: "createTask", kind: "light", title: "D", schedule: { type: "daily", start: "2026-10-01", end: null } }, ctx);
  // 31 units over turn size 8: turns 1-3 full, turn 4 holds 7.
  expect(ws.ledgers.light.turn).toBe(4);
  expect(total(ws)).toBe(7);
  const out = withSemester(ws, "2026-10-01", "2026-10-28");    // drops Oct 29-31, all turn 4
  expect(out.tasks[0].occurrences).toHaveLength(28);
  expect(out.ledgers.light.turn).toBe(4);
  expect(total(out)).toBe(4);
  const dropped = ws.tasks[0].occurrences.filter(o => o.date > "2026-10-28");
  for (const o of dropped) expect(out.ledgers.light.used[o.taId]).toBeLessThan(ws.ledgers.light.used[o.taId]);
});
