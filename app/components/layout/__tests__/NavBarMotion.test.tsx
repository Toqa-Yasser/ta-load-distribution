// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createRoutesStub } from "react-router";
import { indicatorSpring, tabPress } from "~/lib/motion";
import { NavBar } from "../NavBar";

const motionState = vi.hoisted(() => ({ reduced: false }));

// Records the motion props each motion.span receives so the test can read them off the DOM.
vi.mock("motion/react", async (orig) => {
  const actual = await orig<typeof import("motion/react")>();
  const Span = ({ whileTap, whileHover: _h, transition, layoutId, children, ...rest }: Record<string, unknown> & { children?: ReactNode }) => (
    <span
      {...rest}
      data-while-tap={whileTap === undefined ? undefined : JSON.stringify(whileTap)}
      data-transition={transition === undefined ? undefined : JSON.stringify(transition)}
      data-layout-id={layoutId as string | undefined}
    >
      {children}
    </span>
  );
  return { ...actual, useReducedMotion: () => motionState.reduced, motion: { ...actual.motion, span: Span } };
});

const renderBar = () => {
  const Stub = createRoutesStub([{ path: "*", Component: () => <NavBar placement="bottom" /> }]);
  return render(<Stub initialEntries={["/team"]} />);
};

test.each([
  [false, tabPress, indicatorSpring],
  [true, {}, { duration: 0 }],
])("reduced motion %s: tab press and indicator transition", async (reduced, tap, transition) => {
  motionState.reduced = reduced;
  renderBar();
  const nav = await screen.findByRole("navigation", { name: "Primary" });
  const items = nav.querySelectorAll<HTMLElement>('[data-press="tab"]');
  expect(items).toHaveLength(5);
  for (const item of items) expect(JSON.parse(item.dataset.whileTap!)).toEqual(tap);
  const indicator = nav.querySelector<HTMLElement>("[data-tab-indicator]")!;
  expect(indicator.dataset.layoutId).toBe("tab-indicator");
  expect(JSON.parse(indicator.dataset.transition!)).toEqual(transition);
});
