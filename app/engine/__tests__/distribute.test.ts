import { expect, test } from "vitest";
import { assignOccurrences, refund, refundSeats } from "~/engine/distribute";
import { NoCapacityError, NotEnoughTAsError } from "~/engine/types";
import { seededRng } from "~/engine/rng";
const caps = { A: 1, B: 2, C: 2, D: 3 };
const occ = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: `o${from + i}`, date: `2026-10-${String(from + i).padStart(2, "0")}` }));
const count = (occs: { seats: { taId: string }[] }[]) => occs.reduce((m, o) => ({ ...m, [o.seats[0].taId]: (m[o.seats[0].taId] ?? 0) + 1 }), {} as Record<string, number>);

test("first full turn hands out exactly the capacities", () => {
  const r = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(8), taCount: 1, rng: seededRng(1) });
  expect(count(r.occurrences)).toEqual({ A: 1, B: 2, C: 2, D: 3 });
  expect(r.ledger).toEqual({ turn: 1, used: { A: 1, B: 2, C: 2, D: 3 } });
});
test("reference scenario: 10 then ledger A1 B1 → 4 goes C1 D2 and B-or-C 1", () => {
  const ten = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(10), taCount: 1, rng: seededRng(7) });
  expect(ten.ledger.turn).toBe(2);
  expect(Object.values(ten.ledger.used).sort()).toEqual([1, 1]);           // two distinct TAs got the remainder
  expect(ten.occurrences.slice(0, 8).every(o => o.seats[0].turn === 1)).toBe(true);
  expect(ten.occurrences.slice(8).every(o => o.seats[0].turn === 2)).toBe(true);

  const four = assignOccurrences({ capacities: caps, ledger: { turn: 2, used: { A: 1, B: 1 } }, occurrences: occ(4, 11), taCount: 1, rng: seededRng(3) });
  const c = count(four.occurrences);
  expect(c.A).toBeUndefined();
  expect(c.D).toBe(2);
  expect((c.B ?? 0) + (c.C ?? 0)).toBe(2);
  expect(c.C).toBeGreaterThanOrEqual(1);
});
test("ties are broken by rng (rng=0 → first eligible in id order)", () => {
  const r = assignOccurrences({ capacities: { A: 1, B: 1 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), taCount: 1, rng: () => 0 });
  expect(r.occurrences[0].seats[0].taId).toBe("A");
});
test("a TA with capacity 0 is never picked", () => {
  const r = assignOccurrences({ capacities: { A: 0, B: 1 }, ledger: { turn: 1, used: {} }, occurrences: occ(3), taCount: 1, rng: seededRng(1) });
  expect(r.occurrences.every(o => o.seats[0].taId === "B")).toBe(true);
  expect(r.ledger.turn).toBe(3);
});
test("no capacity anywhere throws NoCapacityError", () => {
  expect(() => assignOccurrences({ capacities: { A: 0 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), taCount: 1, rng: seededRng(1) })).toThrow(NoCapacityError);
});
test("input ledger is not mutated", () => {
  const ledger = { turn: 1, used: {} };
  assignOccurrences({ capacities: caps, ledger, occurrences: occ(3), taCount: 1, rng: seededRng(1) });
  expect(ledger).toEqual({ turn: 1, used: {} });
});
test("refund only returns units from the current turn and floors at 0", () => {
  const ledger = { turn: 2, used: { A: 1, B: 0 } };
  const out = refund(ledger, [
    { id: "x", date: "2026-10-01", seats: [{ taId: "A", turn: 2 }] },
    { id: "y", date: "2026-10-02", seats: [{ taId: "A", turn: 1 }] },
    { id: "z", date: "2026-10-03", seats: [{ taId: "B", turn: 2 }] },
  ]);
  expect(out).toEqual({ turn: 2, used: { A: 0, B: 0 } });
});
test.each([1, 2, 3, 4, 5])("reference scenario holds for seed %i", (seed) => {
  const ten = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(10), taCount: 1, rng: seededRng(seed) });
  expect(count(ten.occurrences.slice(0, 8))).toEqual({ A: 1, B: 2, C: 2, D: 3 });
  expect(ten.ledger.turn).toBe(2);
  expect(Object.values(ten.ledger.used).sort()).toEqual([1, 1]);

  const four = assignOccurrences({ capacities: caps, ledger: { turn: 2, used: { A: 1, B: 1 } }, occurrences: occ(4, 11), taCount: 1, rng: seededRng(seed + 100) });
  const c = count(four.occurrences);
  expect(c.A).toBeUndefined();
  expect(c.D).toBe(2);
  expect(c.C).toBeGreaterThanOrEqual(1);
  expect((c.B ?? 0) + (c.C ?? 0)).toBe(2);
});
test("a ledger already over a shrunken capacity is treated as exhausted and its overshoot carries forward", () => {
  // A had capacity 3 when it used 3; it now has 1, so 2 units of overshoot follow it into later turns.
  const r = assignOccurrences({ capacities: { A: 1, B: 1 }, ledger: { turn: 1, used: { A: 3 } }, occurrences: occ(3), taCount: 1, rng: seededRng(1) });
  expect(r.occurrences.map(o => [o.seats[0].taId, o.seats[0].turn])).toEqual([["B", 1], ["B", 2], ["B", 3]]);
  expect(r.ledger).toEqual({ turn: 3, used: { A: 1, B: 1 } });
});
test("stale ledger ids are ignored", () => {
  const r = assignOccurrences({ capacities: { A: 1 }, ledger: { turn: 1, used: { GONE: 5 } }, occurrences: occ(1), taCount: 1, rng: seededRng(1) });
  expect(r.occurrences[0]).toMatchObject({ seats: [{ taId: "A", turn: 1 }] });
});
test("unsorted input is assigned in date order", () => {
  const input = occ(10).reverse();
  const r = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: input, taCount: 1, rng: seededRng(1) });
  expect(r.occurrences.map(o => o.date)).toEqual([...input].map(o => o.date).sort());
  expect(r.occurrences.map(o => o.seats[0].turn)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 2]);
});
test("input arrays and capacities are not mutated", () => {
  const input = occ(5).reverse();
  const snapshot = JSON.stringify(input);
  const capsCopy = { ...caps };
  const ledger = { turn: 1, used: { A: 1 } };
  assignOccurrences({ capacities: caps, ledger, occurrences: input, taCount: 1, rng: seededRng(1) });
  refund(ledger, [{ id: "x", date: "2026-10-01", seats: [{ taId: "A", turn: 1 }] }]);
  expect(JSON.stringify(input)).toBe(snapshot);
  expect(caps).toEqual(capsCopy);
  expect(ledger).toEqual({ turn: 1, used: { A: 1 } });
});

test.each([1, 2, 3, 4, 5])("taCount 2 seats two distinct TAs with the highest remaining fractions (seed %i)", (seed) => {
  const r = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(4), taCount: 2, rng: seededRng(seed) });
  for (const o of r.occurrences) {
    expect(o.seats).toHaveLength(2);
    expect(new Set(o.seats.map(s => s.taId)).size).toBe(2);
    expect(o.seats.every(s => s.turn === 1)).toBe(true);
  }
  expect(r.ledger).toEqual({ turn: 1, used: { A: 1, B: 2, C: 2, D: 3 } });
});
test("overshoot carries across a rollover", () => {
  const first = assignOccurrences({ capacities: { A: 1, B: 1 }, ledger: { turn: 1, used: { A: 1 } }, occurrences: occ(1), taCount: 2, rng: seededRng(1) });
  expect(first.occurrences[0].seats.map(s => s.taId).sort()).toEqual(["A", "B"]);
  expect(first.occurrences[0].seats.every(s => s.turn === 1)).toBe(true);
  expect(first.ledger).toEqual({ turn: 1, used: { A: 2, B: 1 } });

  const second = assignOccurrences({ capacities: { A: 1, B: 1 }, ledger: first.ledger, occurrences: occ(1, 2), taCount: 1, rng: seededRng(1) });
  expect(second.occurrences[0].seats).toEqual([{ taId: "B", turn: 2 }]);
  expect(second.ledger).toEqual({ turn: 2, used: { A: 1, B: 1 } });
});
test("fewer eligible TAs than taCount throws NotEnoughTAsError before dealing", () => {
  const deal = () => assignOccurrences({ capacities: { A: 1, B: 1, C: 0 }, ledger: { turn: 1, used: {} }, occurrences: occ(2), taCount: 3, rng: seededRng(1) });
  expect(deal).toThrow(new NotEnoughTAsError(3, 2));
  expect(deal).toThrow("This task needs 3 TAs but only 2 have sections.");
});
test("NotEnoughTAsError says 'has' for a single TA", () => {
  expect(new NotEnoughTAsError(2, 1).message).toBe("This task needs 2 TAs but only 1 has sections.");
  expect(new NotEnoughTAsError(2, 1)).toMatchObject({ code: "NOT_ENOUGH_TAS", needed: 2, available: 1 });
});
test("NotEnoughTAsError names the task when given its title", () => {
  expect(new NotEnoughTAsError(2, 1, "Lab").message).toBe('"Lab" needs 2 TAs on each date but only 1 has sections.');
  expect(new NotEnoughTAsError(3, 2, "Lab").message).toBe('"Lab" needs 3 TAs on each date but only 2 have sections.');
  expect(new NotEnoughTAsError(3, 2, "Lab")).toMatchObject({ code: "NOT_ENOUGH_TAS", needed: 3, available: 2, taskTitle: "Lab" });
});
test("no capacity anywhere still throws NoCapacityError even with taCount 2", () => {
  expect(() => assignOccurrences({ capacities: { A: 0, B: 0 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), taCount: 2, rng: seededRng(1) })).toThrow(NoCapacityError);
});
test("refill keeps held seats and never seats their TAs again", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const r = assignOccurrences({
      capacities: { A: 1, B: 1, C: 1 }, ledger: { turn: 1, used: { A: 1 } },
      occurrences: [{ id: "o1", date: "2026-10-01", seats: [{ taId: "A", turn: 1 }] }], taCount: 2, rng: seededRng(seed),
    });
    const seats = r.occurrences[0].seats;
    expect(seats[0]).toEqual({ taId: "A", turn: 1 });
    expect(["B", "C"]).toContain(seats[1].taId);
    expect(seats[1].turn).toBe(1);
    expect(r.ledger.used.A).toBe(1);
  }
});
test("refundSeats releases only current-turn seats and floors at 0", () => {
  const out = refundSeats({ turn: 2, used: { A: 1, B: 0 } }, [{ taId: "A", turn: 2 }, { taId: "A", turn: 1 }, { taId: "B", turn: 2 }]);
  expect(out).toEqual({ turn: 2, used: { A: 0, B: 0 } });
});
