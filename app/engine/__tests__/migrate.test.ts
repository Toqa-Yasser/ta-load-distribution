import { isCurrentWorkspace, upgradeWorkspace } from "~/engine/migrate";
import { emptyWorkspace } from "~/engine/empty";
import { ValidationError } from "~/engine/types";

function legacy() {
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

/** A v1.1 document: `ledgers`, task kinds, one TA per occurrence, no `taCount`. */
function v11() {
  const { ledger, tasks, ...rest } = legacy();
  return {
    ...rest,
    tasks: tasks.map((t) => ({ ...t, kind: "light" })),
    ledgers: { light: ledger, heavy: { turn: 1, used: {} } },
  };
}

test("v1.1 document upgrades to seats and taCount 1", () => {
  const doc = v11();
  const out = upgradeWorkspace(doc);
  expect(out.tasks[0].occurrences).toEqual([{ id: "occ_1", date: "2026-10-05", seats: [{ taId: "ta_1", turn: 1 }] }]);
  expect("taId" in out.tasks[0].occurrences[0]).toBe(false);
  expect("turn" in out.tasks[0].occurrences[0]).toBe(false);
  expect(out.tasks[0].taCount).toBe(1);
  expect(out.ledgers).toEqual(doc.ledgers);
  expect(doc).toEqual(v11());
  expect(isCurrentWorkspace(doc)).toBe(false);
  expect(isCurrentWorkspace(out)).toBe(true);
});

test("v1.0 document upgrades through the whole chain", () => {
  const out = upgradeWorkspace(legacy());
  expect(out.tasks[0].kind).toBe("light");
  expect(out.tasks[0].taCount).toBe(1);
  expect(out.tasks[0].occurrences).toEqual([{ id: "occ_1", date: "2026-10-05", seats: [{ taId: "ta_1", turn: 1 }] }]);
  expect(out.ledgers).toEqual({ light: { turn: 1, used: { ta_1: 1 } }, heavy: { turn: 1, used: {} } });
  expect("ledger" in out).toBe(false);
  expect(isCurrentWorkspace(out)).toBe(true);
});

test("mixed v1.1 document accepts tasks already in the new shape", () => {
  const base = v11();
  const t = base.tasks[0];
  const doc = {
    ...base,
    tasks: [
      t,
      { ...t, id: "task_2", taCount: 2, occurrences: [{ id: "occ_2", date: "2026-10-06", seats: [{ taId: "ta_1", turn: 1 }, { taId: "ta_2", turn: 1 }] }] },
      { ...t, id: "task_3", occurrences: [{ id: "occ_3", date: "2026-10-07", seats: [{ taId: "ta_1", turn: 1 }] }] },
    ],
  };
  const out = upgradeWorkspace(doc);
  expect(out.tasks.map((x) => x.taCount)).toEqual([1, 2, 1]);
  expect(out.tasks[0].occurrences[0].seats).toEqual([{ taId: "ta_1", turn: 1 }]);
  expect(out.tasks[1].occurrences).toEqual(doc.tasks[1].occurrences);
  expect(out.tasks[2].occurrences).toEqual(doc.tasks[2].occurrences);
  expect(isCurrentWorkspace(out)).toBe(true);
});

test("legacy ledger + kindless tasks → light", () => {
  const doc = legacy();
  const out = upgradeWorkspace(doc);
  expect(out.tasks[0].kind).toBe("light");
  expect(out.ledgers).toEqual({ light: { turn: 1, used: { ta_1: 1 } }, heavy: { turn: 1, used: {} } });
  expect("ledger" in out).toBe(false);
  expect(out.tasks[0].occurrences).toEqual([{ id: "occ_1", date: "2026-10-05", seats: [{ taId: "ta_1", turn: 1 }] }]);
  expect(isCurrentWorkspace(doc)).toBe(false);
  expect(isCurrentWorkspace(out)).toBe(true);
  // Pure: the input is not mutated.
  expect(doc).toEqual(legacy());
});

test("legacy document with no tasks upgrades", () => {
  const out = upgradeWorkspace({ ...legacy(), tasks: [] });
  expect(out.tasks).toEqual([]);
  expect(out.ledgers.heavy).toEqual({ turn: 1, used: {} });
});

test("current doc returns same reference", () => {
  const ws = emptyWorkspace();
  expect(isCurrentWorkspace(ws)).toBe(true);
  expect(upgradeWorkspace(ws)).toBe(ws);
  const upgraded = upgradeWorkspace(legacy());
  expect(upgradeWorkspace(upgraded)).toBe(upgraded);
});

test('garbage throws ValidationError("Unrecognised workspace document.")', () => {
  const err = new ValidationError("Unrecognised workspace document.");
  const { ledger, ...noLedger } = legacy();
  void ledger;
  const bad: unknown[] = [
    null, undefined, 42, "ws", [], {},
    noLedger,
    { ...legacy(), tasks: "nope" },
    { ...legacy(), ledger: { turn: "1", used: {} } },
    { ...emptyWorkspace(), ledgers: { light: { turn: 1, used: {} } } },
    { ...emptyWorkspace(), tasks: [{ ...legacy().tasks[0], kind: "medium" }] },
  ];
  for (const doc of bad) {
    expect(isCurrentWorkspace(doc)).toBe(false);
    expect(() => upgradeWorkspace(doc)).toThrow(err);
  }
});

test("mixed legacy doc upgrades kindless tasks to light and keeps valid kinds", () => {
  const base = legacy();
  const doc = {
    ...base,
    tasks: [
      { ...base.tasks[0], id: "task_1" },
      { ...base.tasks[0], id: "task_2", kind: "heavy" },
      { ...base.tasks[0], id: "task_3", kind: "light" },
    ],
  };
  const out = upgradeWorkspace(doc);
  expect(out.tasks.map((t) => t.kind)).toEqual(["light", "heavy", "light"]);
  expect(out.ledgers.light).toEqual(base.ledger);
  expect("ledger" in out).toBe(false);
  expect(isCurrentWorkspace(out)).toBe(true);
});

test("legacy tasks with an invalid kind are coerced to light", () => {
  const doc = legacy();
  const bad = [
    { ...doc.tasks[0], id: "a", kind: "medium" },
    { ...doc.tasks[0], id: "b", kind: 3 },
    { ...doc.tasks[0], id: "c", kind: null },
    { ...doc.tasks[0], id: "d", kind: "heavy" },
  ];
  const out = upgradeWorkspace({ ...doc, tasks: bad });
  expect(out.tasks.map((t) => [t.id, t.kind])).toEqual([["a", "light"], ["b", "light"], ["c", "light"], ["d", "heavy"]]);
});

describe("isCurrentWorkspace validates element shapes", () => {
  function current() {
    return upgradeWorkspace(legacy());
  }
  const cases: [string, (ws: ReturnType<typeof current>) => unknown][] = [
    ["ta not an object", (ws) => ({ ...ws, tas: ["ta_1"] })],
    ["ta id not a string", (ws) => ({ ...ws, tas: [{ ...ws.tas[0], id: 1 }] })],
    ["ta name missing", (ws) => ({ ...ws, tas: [{ id: "ta_1", color: "#fff" }] })],
    ["ta color not a string", (ws) => ({ ...ws, tas: [{ ...ws.tas[0], color: null }] })],
    ["section not an object", (ws) => ({ ...ws, sections: [null] })],
    ["section id not a string", (ws) => ({ ...ws, sections: [{ ...ws.sections[0], id: 7 }] })],
    ["section name not a string", (ws) => ({ ...ws, sections: [{ ...ws.sections[0], name: undefined }] })],
    ["section taIds not an array", (ws) => ({ ...ws, sections: [{ ...ws.sections[0], taIds: "ta_1" }] })],
    ["section taIds wrong length", (ws) => ({ ...ws, sections: [{ ...ws.sections[0], taIds: ["ta_1"] }] })],
    ["section taIds too long", (ws) => ({ ...ws, sections: [{ ...ws.sections[0], taIds: ["ta_1", null, null] }] })],
    ["section taIds bad member", (ws) => ({ ...ws, sections: [{ ...ws.sections[0], taIds: ["ta_1", 3] }] })],
    ["occurrences not an array", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: {} }] })],
    ["occurrence not an object", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: ["occ_1"] }] })],
    ["occurrence id not a string", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: [{ ...ws.tasks[0].occurrences[0], id: 1 }] }] })],
    ["occurrence date not a string", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: [{ ...ws.tasks[0].occurrences[0], date: 20261005 }] }] })],
    ["occurrence seats missing", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: [{ id: "occ_1", date: "2026-10-05" }] }] })],
    ["seats empty", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: [{ ...ws.tasks[0].occurrences[0], seats: [] }] }] })],
    ["seat taId not a string", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: [{ ...ws.tasks[0].occurrences[0], seats: [{ taId: null, turn: 1 }] }] }] })],
    ["seat turn not a number", (ws) => ({ ...ws, tasks: [{ ...ws.tasks[0], occurrences: [{ ...ws.tasks[0].occurrences[0], seats: [{ taId: "ta_1", turn: "1" }] }] }] })],
  ];
  test.each(cases)("rejects: %s", (_name, mutate) => {
    const doc = mutate(current());
    expect(isCurrentWorkspace(doc)).toBe(false);
    expect(() => upgradeWorkspace(doc)).toThrow(ValidationError);
  });
  test.each([["missing", undefined], ["0", 0], ["1.5", 1.5], ["a string", "2"]])("taCount %s is not current but upgrades to 1", (_name, taCount) => {
    const ws = current();
    const doc = { ...ws, tasks: [{ ...ws.tasks[0], taCount }] };
    expect(isCurrentWorkspace(doc)).toBe(false);
    expect(upgradeWorkspace(doc).tasks[0].taCount).toBe(1);
  });
  test("a well-formed document with null slots is accepted by reference", () => {
    const ws = current();
    const doc = { ...ws, sections: [{ ...ws.sections[0], taIds: [null, null] }] };
    expect(isCurrentWorkspace(doc)).toBe(true);
    expect(upgradeWorkspace(doc)).toBe(doc);
  });
});
