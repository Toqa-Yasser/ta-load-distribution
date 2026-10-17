// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { Card } from "~/components/ui/Card";
import { cardPress } from "~/lib/motion";

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (orig) => {
  const actual = await orig<typeof import("motion/react")>();
  const Div = ({ whileTap, style: _s, children, ...rest }: Record<string, unknown> & { children?: ReactNode }) => (
    <div {...rest} data-while-tap={whileTap === undefined ? undefined : JSON.stringify(whileTap)}>
      {children}
    </div>
  );
  return { ...actual, useReducedMotion: () => motionState.reduced, motion: { ...actual.motion, div: Div } };
});

beforeEach(() => {
  motionState.reduced = false;
});

test("a pressable card presses to 0.98 and stays out of the tab order", () => {
  const { container } = render(<Card interactive pressable>hi</Card>);
  const card = container.firstElementChild as HTMLElement;
  expect(JSON.parse(card.dataset.whileTap!)).toEqual(cardPress);
  expect(cardPress).toEqual({ scale: 0.98 });
  expect(card).toHaveAttribute("tabindex", "-1");
});

test("cards that only tilt get no press", () => {
  const { container } = render(<Card interactive>hi</Card>);
  const card = container.firstElementChild as HTMLElement;
  expect(card.dataset.whileTap).toBeUndefined();
  expect(card).not.toHaveAttribute("tabindex");
});

test("reduced motion: no press", () => {
  motionState.reduced = true;
  const { container } = render(<Card interactive pressable>hi</Card>);
  expect(JSON.parse((container.firstElementChild as HTMLElement).dataset.whileTap!)).toEqual({});
});
