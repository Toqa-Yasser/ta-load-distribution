// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Sheet } from "~/components/ui/Sheet";
import { scrimMotion, SHEET_BLUR } from "~/lib/motion";

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => reduced.value }));
afterEach(() => {
  reduced.value = false;
});

const css = readFileSync(`${process.cwd()}/app/app.css`, "utf8").replace(/\s+/g, " ");
const scrim = () => document.querySelector<HTMLElement>("[data-sheet-scrim]")!;

test("the scrim blur tweens from 0 to 8px with the fade, and back on exit", () => {
  expect(SHEET_BLUR).toBe("8px");
  const m = scrimMotion(false);
  expect(m.initial).toEqual({ opacity: 0, "--sheet-blur": "0px" });
  expect(m.animate).toEqual({ opacity: 1, "--sheet-blur": "8px" });
  expect(m.exit).toEqual({ opacity: 0, "--sheet-blur": "0px" });
  expect(m.transition).toMatchObject({ duration: 0.2 });
});

test("reduced motion: the scrim starts at its final values (no blur tween)", () => {
  const m = scrimMotion(true);
  expect(m.initial).toEqual(m.animate);
  expect(m.animate).toEqual({ opacity: 1, "--sheet-blur": "8px" });
  expect(m.transition).toEqual({ duration: 0 });
});

test("both backdrop-filter properties read the animated variable (Safari needs the prefix)", () => {
  const rule = "blur(calc(var(--sheet-blur, 0px) * var(--sheet-drag, 1)))";
  expect(css).toContain(`.sheet-scrim { -webkit-backdrop-filter: ${rule}; backdrop-filter: ${rule}; }`);
});

test("the blur sits on the outer scrim, not under an opacity-animated ancestor", () => {
  render(<Sheet open onClose={() => {}} title="Blur"><p>body</p></Sheet>);
  expect(scrim().className).toContain("sheet-scrim");
  const color = document.querySelector<HTMLElement>("[data-sheet-backdrop]")!;
  expect(scrim()).toContainElement(color);
  expect(color.className).not.toMatch(/backdrop-blur/);
});

test("reduced motion renders the scrim fully blurred on the first frame", () => {
  reduced.value = true;
  render(<Sheet open onClose={() => {}} title="Blur"><p>body</p></Sheet>);
  expect(scrim().style.getPropertyValue("--sheet-blur")).toBe("8px");
});

test("dragging the bottom sheet scales the blur with the scrim colour", async () => {
  render(<Sheet open onClose={() => {}} title="Drag"><p>body</p></Sheet>);
  const handle = document.querySelector<HTMLElement>("[data-sheet-handle]")!;
  const ptr = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: "touch" };
  fireEvent.pointerDown(handle, { ...ptr, clientX: 100, clientY: 100 });
  for (const y of [110, 130, 160]) fireEvent.pointerMove(window, { ...ptr, clientX: 100, clientY: y });
  await waitFor(() => expect(Number(scrim().style.getPropertyValue("--sheet-drag"))).toBeCloseTo(0.5, 1));
  fireEvent.pointerUp(window, { ...ptr, clientX: 100, clientY: 160 });
});
