import { assignOccurrences, refund } from "~/engine/distribute";
import { NoCapacityError } from "~/engine/types";
import { seededRng } from "~/engine/rng";
const caps = { A: 1, B: 2, C: 2, D: 3 };
const occ = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: `o${from + i}`, date: `2026-10-${String(from + i).padStart(2, "0")}` }));
const count = (occs: { taId: string }[]) => occs.reduce((m, o) => ({ ...m, [o.taId]: (m[o.taId] ?? 0) + 1 }), {} as Record<string, number>);

test("first full turn hands out exactly the capacities", () => {
  const r = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(8), rng: seededRng(1) });
  expect(count(r.occurrences)).toEqual({ A: 1, B: 2, C: 2, D: 3 });
  expect(r.ledger).toEqual({ turn: 1, used: { A: 1, B: 2, C: 2, D: 3 } });
});
test("reference scenario: 10 then ledger A1 B1 → 4 goes C1 D2 and B-or-C 1", () => {
  const ten = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(10), rng: seededRng(7) });
  expect(ten.ledger.turn).toBe(2);
  expect(Object.values(ten.ledger.used).sort()).toEqual([1, 1]);           // two distinct TAs got the remainder
  expect(ten.occurrences.slice(0, 8).every(o => o.turn === 1)).toBe(true);
  expect(ten.occurrences.slice(8).every(o => o.turn === 2)).toBe(true);

  const four = assignOccurrences({ capacities: caps, ledger: { turn: 2, used: { A: 1, B: 1 } }, occurrences: occ(4, 11), rng: seededRng(3) });
  const c = count(four.occurrences);
  expect(c.A).toBeUndefined();
  expect(c.D).toBe(2);
  expect((c.B ?? 0) + (c.C ?? 0)).toBe(2);
  expect(c.C).toBeGreaterThanOrEqual(1);
});
test("ties are broken by rng (rng=0 → first eligible in id order)", () => {
  const r = assignOccurrences({ capacities: { A: 1, B: 1 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), rng: () => 0 });
  expect(r.occurrences[0].taId).toBe("A");
});
test("a TA with capacity 0 is never picked", () => {
  const r = assignOccurrences({ capacities: { A: 0, B: 1 }, ledger: { turn: 1, used: {} }, occurrences: occ(3), rng: seededRng(1) });
  expect(r.occurrences.every(o => o.taId === "B")).toBe(true);
  expect(r.ledger.turn).toBe(3);
});
test("no capacity anywhere throws NoCapacityError", () => {
  expect(() => assignOccurrences({ capacities: { A: 0 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), rng: seededRng(1) })).toThrow(NoCapacityError);
});
test("input ledger is not mutated", () => {
  const ledger = { turn: 1, used: {} };
  assignOccurrences({ capacities: caps, ledger, occurrences: occ(3), rng: seededRng(1) });
  expect(ledger).toEqual({ turn: 1, used: {} });
});
test("refund only returns units from the current turn and floors at 0", () => {
  const ledger = { turn: 2, used: { A: 1, B: 0 } };
  const out = refund(ledger, [
    { id: "x", date: "2026-10-01", taId: "A", turn: 2 },
    { id: "y", date: "2026-10-02", taId: "A", turn: 1 },
    { id: "z", date: "2026-10-03", taId: "B", turn: 2 },
  ]);
  expect(out).toEqual({ turn: 2, used: { A: 0, B: 0 } });
});
