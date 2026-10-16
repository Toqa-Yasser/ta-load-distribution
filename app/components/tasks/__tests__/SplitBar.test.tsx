// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { SplitBar } from "~/components/tasks/SplitBar";
import type { Occurrence, TA } from "~/engine/types";

vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => true }));

const tas: TA[] = [
  { id: "A", name: "Ahmed", color: "#f00" },
  { id: "B", name: "Bassel", color: "#00f" },
];
const occ = (taIds: string[]): Occurrence[] => taIds.map((taId, i) => ({ id: `o${i}`, date: "2026-10-20", taId, turn: 1 }));
const widths = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>("[role=img] > div")].map((d) => d.style.width);

test("renders one segment per TA with proportional widths", () => {
  const { container, rerender } = render(<SplitBar occurrences={occ(["A", "B"])} tas={tas} />);
  expect(widths(container)).toEqual(["50%", "50%"]);
  // Under reduced motion a change applies immediately, with no width tween.
  rerender(<SplitBar occurrences={occ(["A", "B", "B", "B"])} tas={tas} />);
  expect(widths(container)).toEqual(["25%", "75%"]);
});
