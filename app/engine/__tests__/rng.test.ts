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
