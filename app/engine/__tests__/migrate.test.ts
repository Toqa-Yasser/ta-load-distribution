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

test("legacy ledger + kindless tasks → light", () => {
  const doc = legacy();
  const out = upgradeWorkspace(doc);
  expect(out.tasks[0].kind).toBe("light");
  expect(out.ledgers).toEqual({ light: { turn: 1, used: { ta_1: 1 } }, heavy: { turn: 1, used: {} } });
  expect("ledger" in out).toBe(false);
  expect(out.tasks[0].occurrences).toEqual(doc.tasks[0].occurrences);
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
