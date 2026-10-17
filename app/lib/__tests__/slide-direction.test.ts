import { ROUTE_ORDER, backdropOpacityFor, pageVariants, pageVariantsFor, phonePageTransition, slideDirection } from "~/lib/motion";

const pairs = ROUTE_ORDER.flatMap((from, i) => ROUTE_ORDER.map((to, j) => [from, to, Math.sign(j - i)] as const));

test("ROUTE_ORDER is the tab order", () => {
  expect(ROUTE_ORDER).toEqual(["/", "/team", "/tasks", "/calendar", "/history"]);
});

test.each(pairs)("slideDirection(%s → %s) = %i", (from, to, dir) => {
  expect(slideDirection(from, to)).toBe(dir);
});

test.each([
  ["/tasks", "/tasks/t1", 1],
  ["/", "/tasks/t1", 1],
  ["/history", "/tasks/t1", 1],
  ["/tasks/t1", "/tasks", -1],
  ["/tasks/t1", "/", -1],
  ["/tasks/t1", "/history", -1],
  ["/tasks/t1", "/tasks/t2", 1],
  ["/tasks/t1", "/tasks/t1", 0],
  ["/tasks/", "/tasks", 0],
  ["/nowhere", "/team", 0],
  ["/team", "/nowhere", 0],
] as const)("slideDirection(%s → %s) = %i (task detail, same and unknown routes)", (from, to, dir) => {
  expect(slideDirection(from, to)).toBe(dir);
});

test("phone variants slide 24px horizontally in the direction of travel; desktop keeps the fade/rise", () => {
  expect(pageVariantsFor(1, true)).toEqual({
    initial: { opacity: 0, x: 24 },
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  });
  expect(pageVariantsFor(-1, true).initial).toEqual({ opacity: 0, x: -24 });
  expect(pageVariantsFor(-1, true).exit).toEqual({ opacity: 0, x: 24 });
  expect(pageVariantsFor(1, false)).toBe(pageVariants);
  expect(phonePageTransition).toMatchObject({ duration: 0.18 });
});

test("backdrop opacity is 1 at rest, 0 at the dismiss distance, clamped either side", () => {
  expect(backdropOpacityFor(0, 120)).toBe(1);
  expect(backdropOpacityFor(-10, 120)).toBe(1);
  expect(backdropOpacityFor(60, 120)).toBeCloseTo(0.5);
  expect(backdropOpacityFor(120, 120)).toBe(0);
  expect(backdropOpacityFor(400, 120)).toBe(0);
});
