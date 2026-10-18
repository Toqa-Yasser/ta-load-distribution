import { reduce, describe as describeCmd } from "~/engine/reducer";
import { NotEnoughTAsError, ValidationError, type Command, type Ledger, type Occurrence, type Schedule, type SeatRef, type Workspace } from "~/engine/types";
import { ctx, equalDaily, teamWithE } from "./fixtures";

const fresh: Ledger = { turn: 1, used: {} };

function setup() {
  const { ws, id } = teamWithE();
  const name = (taId: string) => ws.tas.find((t) => t.id === taId)?.name ?? taId;
  const names = (occs: Occurrence[]) => occs.map((o) => o.seats.map((s) => name(s.taId)));
  const ids = (...ns: string[]) => ns.map(id);
  return { ws, id, ids, names };
}

const daily = (days: number): Schedule => ({ type: "daily", start: "2026-10-01", end: `2026-10-${String(days).padStart(2, "0")}` });
const ref = (taskId: string, o: Occurrence): SeatRef => ({ taskId, occurrenceId: o.id, taId: o.seats[0].taId });
const letters = (s: string) => [...s].map((c) => [c]);

test("createTask equal rotates over the order, ignores sections and leaves both ledgers fresh", () => {
  const { ws, ids, names } = setup();
  const out = equalDaily(ws, ids("A", "B", "E"), 6);
  const task = out.tasks[0];
  expect(names(task.occurrences)).toEqual(letters("ABEABE"));
  expect(task.taOrder).toEqual(ids("A", "B", "E"));
  expect(task.kind).toBe("equal");
  expect(out.ledgers).toEqual({ light: fresh, heavy: fresh });
  expect(Object.keys(out.ledgers).sort()).toEqual(["heavy", "light"]);
});

test("createTask equal requires a valid taOrder", () => {
  const { ws, id } = setup();
  const create = (taOrder: unknown, taCount = 1) =>
    reduce(ws, { type: "createTask", kind: "equal", title: "Duty", taCount, taOrder, schedule: daily(2) } as Command, ctx);
  const pick = new ValidationError("Pick the TA order for an equal task.");
  expect(() => create(undefined)).toThrow(pick);
  expect(() => create("A")).toThrow(pick);
  expect(() => create([id("A"), id("A")])).toThrow(pick);
  expect(() => create([id("A"), "nope"])).toThrow(pick);
  expect(() => create([])).toThrow(new ValidationError("Add TAs on the Team page first."));
  expect(() => create([id("A")], 2)).toThrow(NotEnoughTAsError);
  expect(() => create([id("A")], 2)).toThrow("This task needs 2 TAs but only 1 is in its order.");
});

test("createTask light ignores taOrder", () => {
  const { ws, id } = setup();
  const out = reduce(ws, { type: "createTask", kind: "light", title: "L", taOrder: [id("A")], schedule: daily(2) }, ctx);
  expect("taOrder" in out.tasks[0]).toBe(false);
});

test("removeTA refills only the removed TA's seats and shrinks the order", () => {
  const { ws, id, ids, names } = setup();
  const before = equalDaily(ws, ids("A", "B", "E"), 6);
  const out = reduce(before, { type: "removeTA", taId: id("B") }, ctx);
  const occs = out.tasks[0].occurrences;
  expect(names(occs)).toEqual(letters("AAEAEE"));
  expect(occs[1].seats[0].turn).toBe(3);
  expect(occs[4].seats[0].turn).toBe(3);
  expect(out.tasks[0].taOrder).toEqual(ids("A", "E"));
  for (const i of [0, 2, 3, 5]) expect(occs[i]).toBe(before.tasks[0].occurrences[i]);
});

test("removeTA shrinks the order of an Equal task even when the TA held no seat", () => {
  const { ws, id, ids, names } = setup();
  const before = equalDaily(ws, ids("A", "B", "E"), 2);
  expect(names(before.tasks[0].occurrences)).toEqual(letters("AB"));
  const out = reduce(before, { type: "removeTA", taId: id("E") }, ctx);
  expect(out.tasks[0].taOrder).toEqual(ids("A", "B"));
  expect(out.tasks[0].occurrences).toBe(before.tasks[0].occurrences);
});

test("removeTA is refused when an Equal order would be empty", () => {
  const { ws, id, ids } = setup();
  const before = equalDaily(ws, ids("E"), 2);
  expect(() => reduce(before, { type: "removeTA", taId: id("E") }, ctx)).toThrow(new ValidationError('"Duty" has no TA left to cover its dates.'));
});

test("removeTA is refused when an Equal order becomes too short for taCount", () => {
  const { ws, id, ids } = setup();
  const before = equalDaily(ws, ids("A", "B"), 2, "Lab", 2);
  const remove = () => reduce(before, { type: "removeTA", taId: id("B") }, ctx);
  expect(remove).toThrow(NotEnoughTAsError);
  expect(remove).toThrow('"Lab" needs 2 TAs on each date but only 1 is in its order.');
});

test("removeTA refills a seat held by a TA outside the Equal order with the order's least-loaded TA", () => {
  const { ws, id, ids, names } = setup();
  const cases: [number, number, string][] = [
    // A E A: A holds both other dates, so B takes E's seat.
    [3, 1, "ABA"],
    // E B A: one date each, so the tie goes to A, first in the order.
    [3, 0, "ABA"],
  ];
  for (const [days, seat, expected] of cases) {
    const t = equalDaily(ws, ids("A", "B"), days);
    const task = t.tasks[0];
    const occ = task.occurrences[seat];
    const from = occ.seats[0].taId;
    const before = reduce(t, { type: "reassignOccurrence", ref: { taskId: task.id, occurrenceId: occ.id }, from, taId: id("E") }, ctx);
    expect(before.tasks[0].occurrences[seat].seats[0].taId).toBe(id("E"));
    let out!: Workspace;
    expect(() => (out = reduce(before, { type: "removeTA", taId: id("E") }, ctx))).not.toThrow();
    const occs = out.tasks[0].occurrences;
    expect(names(occs)).toEqual(letters(expected));
    expect(out.tasks[0].taOrder).toEqual(ids("A", "B"));
    occs.forEach((o, i) => {
      if (i !== seat) expect(o).toBe(before.tasks[0].occurrences[i]);
    });
  }
});

test("removeTA leaves Equal tasks that do not list the TA untouched", () => {
  const { ws, id, ids } = setup();
  const before = equalDaily(ws, ids("A", "B"), 3);
  const out = reduce(before, { type: "removeTA", taId: id("E") }, ctx);
  expect(out.tasks[0]).toBe(before.tasks[0]);
});

test("redistributeTask re-deals an Equal task over its order without touching ledgers", () => {
  const { ws, ids, names } = setup();
  const t = equalDaily(ws, ids("A", "B", "E"), 6);
  const task = t.tasks[0];
  const swapped = reduce(t, { type: "swapOccurrences", a: ref(task.id, task.occurrences[0]), b: ref(task.id, task.occurrences[1]) }, ctx);
  expect(names(swapped.tasks[0].occurrences)).toEqual(letters("BAEABE"));
  const out = reduce(swapped, { type: "redistributeTask", taskId: task.id }, ctx);
  expect(names(out.tasks[0].occurrences)).toEqual(letters("ABEABE"));
  expect(out.ledgers).toEqual(swapped.ledgers);
});

test("redistributeAll re-deals Equal tasks and resets only the two ledgers", () => {
  const { ws, ids, names } = setup();
  let t = reduce(ws, { type: "createTask", kind: "light", title: "L", schedule: daily(4) }, ctx);
  t = equalDaily(t, ids("A", "B", "E"), 6);
  const task = t.tasks[1];
  const swapped = reduce(t, { type: "swapOccurrences", a: ref(task.id, task.occurrences[0]), b: ref(task.id, task.occurrences[2]) }, ctx);
  expect(names(swapped.tasks[1].occurrences)).toEqual(letters("EBAABE"));
  const out = reduce(swapped, { type: "redistributeAll" }, ctx);
  expect(names(out.tasks[1].occurrences)).toEqual(letters("ABEABE"));
  expect(Object.keys(out.ledgers)).toEqual(["light", "heavy"]);
  expect(out.ledgers.heavy).toEqual(fresh);
});

test("updateTask schedule re-deals over the order", () => {
  const { ws, ids, names } = setup();
  const t = equalDaily(ws, ids("A", "B", "E"), 6);
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, schedule: daily(3) }, ctx);
  const occs = out.tasks[0].occurrences;
  expect(names(occs)).toEqual(letters("ABE"));
  const oldIds = new Set(t.tasks[0].occurrences.map((o) => o.id));
  expect(occs.every((o) => !oldIds.has(o.id))).toBe(true);
  expect(out.ledgers).toEqual(t.ledgers);
});

test("deleteTask equal leaves ledgers unchanged", () => {
  const { ws, ids } = setup();
  let t = reduce(ws, { type: "createTask", kind: "light", title: "L", schedule: daily(3) }, ctx);
  t = equalDaily(t, ids("A", "B", "E"), 3);
  const out = reduce(t, { type: "deleteTask", taskId: t.tasks[1].id }, ctx);
  expect(out.tasks).toHaveLength(1);
  expect(out.ledgers).toEqual(t.ledgers);
});

test("swapping two Equal seats trades them and leaves ledgers unchanged", () => {
  const { ws, ids, names } = setup();
  const t = equalDaily(ws, ids("A", "B", "E"), 3);
  const task = t.tasks[0];
  const out = reduce(t, { type: "swapOccurrences", a: ref(task.id, task.occurrences[0]), b: ref(task.id, task.occurrences[2]) }, ctx);
  expect(names(out.tasks[0].occurrences)).toEqual(letters("EBA"));
  expect(out.ledgers).toEqual(t.ledgers);
});

test("swapping an Equal seat with a light seat throws", () => {
  const { ws, ids } = setup();
  let t = reduce(ws, { type: "createTask", kind: "light", title: "L", schedule: daily(3) }, ctx);
  t = equalDaily(t, ids("A", "B", "E"), 3);
  const [light, equal] = t.tasks;
  const cmd: Command = { type: "swapOccurrences", a: ref(equal.id, equal.occurrences[0]), b: ref(light.id, light.occurrences[1]) };
  expect(() => reduce(t, cmd, ctx)).toThrow(new ValidationError("Only tasks of the same kind can be swapped."));
});

test("reassignOccurrence on an Equal seat moves it without a ledger change", () => {
  const { ws, id, ids, names } = setup();
  let t = reduce(ws, { type: "createTask", kind: "light", title: "L", schedule: daily(3) }, ctx);
  t = equalDaily(t, ids("A", "B", "E"), 3);
  const equal = t.tasks[1];
  const occ = equal.occurrences[0];
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: equal.id, occurrenceId: occ.id }, from: id("A"), taId: id("E") }, ctx);
  expect(names(out.tasks[1].occurrences)).toEqual(letters("EBE"));
  expect(out.ledgers).toEqual(t.ledgers);
});

test("setSemester extension continues the rotation by counts", () => {
  const { ws: base, ids, names } = setup();
  let ws: Workspace = reduce(base, { type: "setSemester", semester: { name: "F", start: "2026-10-01", end: "2026-10-21" } }, ctx);
  ws = reduce(ws, { type: "createTask", kind: "equal", title: "Duty", taOrder: ids("A", "B", "E"), schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  const before = ws.tasks[0].occurrences;
  expect(names(before)).toEqual(letters("ABE"));
  const out = reduce(ws, { type: "setSemester", semester: { name: "F", start: "2026-10-01", end: "2026-11-04" } }, ctx);
  const occs = out.tasks[0].occurrences;
  expect(occs).toHaveLength(5);
  expect(names(occs.slice(3))).toEqual(letters("AB"));
  expect(occs.slice(3).map((o) => o.seats[0].turn)).toEqual([2, 2]);
  for (let i = 0; i < 3; i++) expect(occs[i]).toBe(before[i]);
  expect(out.ledgers).toEqual(ws.ledgers);
});

test("describe says Added equal task", () => {
  const { ws, id } = setup();
  const cmd: Command = { type: "createTask", kind: "equal", title: "Duty", schedule: daily(2), taOrder: [id("A")] };
  expect(describeCmd(cmd, ws)).toBe('Added equal task "Duty"');
});
