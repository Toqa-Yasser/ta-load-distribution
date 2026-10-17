import { STAGGER_MAX, STAGGER_STEP_MS, overlayPop, overlayTransition, stagger } from "~/lib/motion";

test("stagger gives each block the enter class and its index as --stagger", () => {
  expect(stagger(0)).toEqual({ className: "enter-rise", style: { "--stagger": 0 } });
  expect(stagger(3).style).toEqual({ "--stagger": 3 });
});

test("stagger caps at the 8th block, so long lists never wait more than 7 steps", () => {
  expect(STAGGER_MAX).toBe(8);
  expect(STAGGER_STEP_MS).toBe(40);
  expect(stagger(7).style).toEqual({ "--stagger": 7 });
  expect(stagger(8).style).toEqual({ "--stagger": 7 });
  expect(stagger(50).style).toEqual({ "--stagger": 7 });
});

test("stagger clamps negative or fractional indexes", () => {
  expect(stagger(-2).style).toEqual({ "--stagger": 0 });
  expect(stagger(2.7).style).toEqual({ "--stagger": 2 });
});

test("the header variant fades down instead of rising", () => {
  expect(stagger(1, "down")).toEqual({ className: "enter-down", style: { "--stagger": 1 } });
});

test("sheets and menus share one pop preset; reduced motion keeps opacity and transform still", () => {
  const pop = overlayPop(false, 8);
  expect(pop.initial).toEqual({ opacity: 0, scale: 0.96, y: 8 });
  expect(pop.animate).toEqual({ opacity: 1, scale: 1, y: 0 });
  expect(pop.transition).toBe(overlayTransition);
  const still = overlayPop(true, 8);
  expect(still.initial).toEqual(still.animate);
  expect(still.exit).toEqual(still.animate);
  expect(still.transition).toEqual({ duration: 0 });
});

test("stagger merges extra classes after the enter class", () => {
  expect(stagger(2, "rise", "flex gap-2").className).toBe("enter-rise flex gap-2");
});
