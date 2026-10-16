import { expect, test } from "vitest";
import { capacities, turnSize, remainingFraction } from "~/engine/capacity";
import { emptyWorkspace } from "~/engine/empty";

const ws = { ...emptyWorkspace(),
  tas: [{ id: "A", name: "A", color: "#000" }, { id: "B", name: "B", color: "#000" }, { id: "Z", name: "Z", color: "#000" }],
  sections: [
    { id: "s1", name: "S1", taIds: ["A", "B"] as [string, string] },
    { id: "s2", name: "S2", taIds: ["B", "B"] as [string, string] },
    { id: "s3", name: "S3", taIds: [null, null] as [null, null] },
  ] };

test("a section counts +1 for each slot, a TA in both slots gets +2", () => {
  expect(capacities(ws)).toEqual({ A: 1, B: 3, Z: 0 });
});
test("turnSize is the sum of capacities", () => { expect(turnSize(ws)).toBe(4); });
test("remainingFraction", () => {
  expect(remainingFraction(3, 1)).toBeCloseTo(2 / 3);
  expect(remainingFraction(0, 0)).toBe(-Infinity);
});
test("capacity ignores slot ids that no longer match a TA", () => {
  const dangling = { ...ws, sections: [...ws.sections, { id: "s4", name: "S4", taIds: ["GONE", "A"] as [string, string] }] };
  expect(capacities(dangling)).toEqual({ A: 2, B: 3, Z: 0 });
  expect("GONE" in capacities(dangling)).toBe(false);
});
