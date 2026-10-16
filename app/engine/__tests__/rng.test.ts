import { expect, test } from "vitest";
import { seededRng, pick } from "~/engine/rng";
test("seededRng is deterministic and in [0,1)", () => {
  const a = seededRng(42), b = seededRng(42);
  const xs = [a(), a(), a()];
  expect(xs).toEqual([b(), b(), b()]);
  for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
});
test("pick returns first item when rng is 0 and last when rng → 1", () => {
  expect(pick(["x", "y", "z"], () => 0)).toBe("x");
  expect(pick(["x", "y", "z"], () => 0.999)).toBe("z");
});
test("different seeds give different sequences; seed 1 has a fixed first value", () => {
  const a = seededRng(1), b = seededRng(2);
  expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  expect(seededRng(1)()).toBe(0.6270739405881613);
});
test("pick throws RangeError on an empty list", () => {
  expect(() => pick([], () => 0)).toThrow(RangeError);
});
