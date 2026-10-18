import { dealEqual } from "~/engine/equal";
import { NotEnoughTAsError, ValidationError, type Occurrence } from "~/engine/types";

const d = (n: number) => `2026-10-0${n}`;
const pending = (...ns: number[]) => ns.map((n) => ({ id: `o${n}`, date: d(n), seats: [] }));
const seatsOf = (out: Occurrence[]) => out.map((o) => o.seats);

test("six dates over A, B, D rotate A B D A B D with rounds 1 1 1 2 2 2", () => {
  const out = dealEqual({ order: ["A", "B", "D"], occurrences: pending(1, 2, 3, 4, 5, 6), taCount: 1 });
  expect(out.map((o) => o.seats[0].taId)).toEqual(["A", "B", "D", "A", "B", "D"]);
  expect(out.map((o) => o.seats[0].turn)).toEqual([1, 1, 1, 2, 2, 2]);
});

test("taCount 2 seats distinct TAs and keeps every TA within one date of the others", () => {
  const out = dealEqual({ order: ["A", "B", "D"], occurrences: pending(1, 2, 3), taCount: 2 });
  expect(seatsOf(out)).toEqual([
    [{ taId: "A", turn: 1 }, { taId: "B", turn: 1 }],
    [{ taId: "D", turn: 1 }, { taId: "A", turn: 2 }],
    [{ taId: "B", turn: 2 }, { taId: "D", turn: 2 }],
  ]);
});

test("ties follow order position", () => {
  const out = dealEqual({ order: ["D", "A", "B"], occurrences: pending(1, 2), taCount: 1 });
  expect(out.map((o) => o.seats[0].taId)).toEqual(["D", "A"]);
});

test("a refill counts held seats and skips TAs already on the date", () => {
  const held: Occurrence[] = [
    { id: "o1", date: d(1), seats: [{ taId: "A", turn: 1 }] },
    { id: "o3", date: d(3), seats: [{ taId: "D", turn: 1 }] },
    { id: "o4", date: d(4), seats: [{ taId: "A", turn: 2 }] },
  ];
  const out = dealEqual({ order: ["A", "D"], occurrences: pending(2, 5), taCount: 1, held });
  expect(out.map((o) => o.id)).toEqual(["o2", "o5"]);
  expect(seatsOf(out)).toEqual([[{ taId: "D", turn: 2 }], [{ taId: "A", turn: 3 }]]);
});

test("kept seats are preserved first and never duplicated", () => {
  const out = dealEqual({ order: ["A", "B"], occurrences: [{ id: "o1", date: d(1), seats: [{ taId: "B", turn: 1 }] }], taCount: 2 });
  expect(seatsOf(out)).toEqual([[{ taId: "B", turn: 1 }, { taId: "A", turn: 1 }]]);
});

test("an empty order throws the wizard message", () => {
  expect(() => dealEqual({ order: [], occurrences: pending(1), taCount: 1 })).toThrow(new ValidationError("Add TAs on the Team page first."));
  expect(() => dealEqual({ order: [], occurrences: pending(1), taCount: 1, taskTitle: "Lab" })).toThrow(
    new ValidationError('"Lab" has no TA left to cover its dates.'),
  );
});

test("a short order throws NotEnoughTAsError with order wording", () => {
  let err: unknown;
  try {
    dealEqual({ order: ["A"], occurrences: pending(1), taCount: 2 });
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(NotEnoughTAsError);
  expect((err as NotEnoughTAsError).message).toBe("This task needs 2 TAs but only 1 is in its order.");
  expect((err as NotEnoughTAsError).reason).toBe("order");
  expect((err as NotEnoughTAsError).code).toBe("NOT_ENOUGH_TAS");
  expect(() => dealEqual({ order: ["A"], occurrences: pending(1), taCount: 2, taskTitle: "Lab" })).toThrow(
    '"Lab" needs 2 TAs on each date but only 1 is in its order.',
  );
  expect(() => dealEqual({ order: ["A"], occurrences: pending(1), taCount: 3 })).toThrow("but only 1 is in its order.");
  expect(() => dealEqual({ order: ["A", "B"], occurrences: pending(1), taCount: 3 })).toThrow("but only 2 are in its order.");
});

test("a failed deal throws before touching anything", () => {
  const occurrences = [{ id: "o1", date: d(1), seats: [{ taId: "A", turn: 1 }] }, ...pending(2)];
  const copy = structuredClone(occurrences);
  expect(() => dealEqual({ order: ["A"], occurrences, taCount: 2 })).toThrow(NotEnoughTAsError);
  expect(occurrences).toEqual(copy);
});

test("NotEnoughTAsError keeps today's wording by default", () => {
  expect(new NotEnoughTAsError(3, 2).message).toBe("This task needs 3 TAs but only 2 have sections.");
});
