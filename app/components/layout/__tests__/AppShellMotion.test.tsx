// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createRoutesStub, Link } from "react-router";
import { pageTransition, phonePageTransition } from "~/lib/motion";
import { AppShell } from "../AppShell";

const state = vi.hoisted(() => ({ phone: false, reduced: false }));

vi.mock("~/lib/motion", async (orig) => ({
  ...(await orig<typeof import("~/lib/motion")>()),
  useMediaQuery: () => state.phone,
}));

type Variant = Record<string, unknown> | ((custom: unknown) => Record<string, unknown>);
const resolve = (v: Variant | undefined, custom: unknown) => JSON.stringify(typeof v === "function" ? v(custom) : v);

// Records the resolved page variants on the DOM; AnimatePresence renders the current page only.
vi.mock("motion/react", async (orig) => {
  const actual = await orig<typeof import("motion/react")>();
  const Main = ({ variants, custom, transition, children, initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown> & { children?: ReactNode }) => {
    const v = variants as Record<string, Variant>;
    return (
      <main
        {...rest}
        data-initial={resolve(v.initial, custom)}
        data-exit={resolve(v.exit, custom)}
        data-transition={JSON.stringify(transition)}
      >
        {children}
      </main>
    );
  };
  return {
    ...actual,
    useReducedMotion: () => state.reduced,
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    motion: { ...actual.motion, main: Main },
  };
});
vi.mock("../Header", () => ({ Header: () => null }));
vi.mock("../NavBar", () => ({ NavBar: () => null }));
vi.mock("../Background", () => ({ Background: () => null }));
vi.mock("../SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("../CommandToasts", () => ({ CommandToasts: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("~/lib/use-history", () => ({ UNDO_FETCHER_KEY: "undo", useHistory: () => {} }));

const page = (name: string) => () => (
  <>
    <h1>{name}</h1>
    <Link to="/">to dashboard</Link>
    <Link to="/tasks">to tasks</Link>
    <Link to="/tasks/t1">to detail</Link>
  </>
);

const renderShell = () => {
  const Stub = createRoutesStub([
    {
      Component: AppShell,
      children: [
        { path: "/", Component: page("Dashboard") },
        { path: "/tasks", Component: page("Tasks") },
        { path: "/tasks/:id", Component: page("Detail") },
      ],
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

const main = () => document.querySelector("main")!;
const go = async (name: string, heading: string) => {
  await act(async () => screen.getByRole("link", { name }).click());
  await screen.findByRole("heading", { name: heading });
};
const states = () => ({ initial: JSON.parse(main().dataset.initial!), exit: JSON.parse(main().dataset.exit!) });

beforeEach(() => {
  state.reduced = false;
});

test("AppShell uses horizontal variants below md and fade above", async () => {
  state.phone = true;
  renderShell();
  await screen.findByRole("heading", { name: "Dashboard" });
  await go("to tasks", "Tasks");
  expect(states()).toEqual({ initial: { opacity: 0, x: 24 }, exit: { opacity: 0, x: -24 } });
  expect(JSON.parse(main().dataset.transition!)).toEqual(phonePageTransition);
  await go("to detail", "Detail");
  expect(states().initial).toEqual({ opacity: 0, x: 24 });
  await go("to dashboard", "Dashboard");
  expect(states()).toEqual({ initial: { opacity: 0, x: -24 }, exit: { opacity: 0, x: 24 } });
});

test("AppShell keeps the fade/rise from md up", async () => {
  state.phone = false;
  renderShell();
  await screen.findByRole("heading", { name: "Dashboard" });
  await go("to tasks", "Tasks");
  expect(states()).toEqual({ initial: { opacity: 0, y: 12 }, exit: { opacity: 0, y: -12 } });
  expect(JSON.parse(main().dataset.transition!)).toEqual(pageTransition);
});

test("reduced motion swaps pages instantly on phones too", async () => {
  state.phone = true;
  state.reduced = true;
  renderShell();
  await screen.findByRole("heading", { name: "Dashboard" });
  await go("to tasks", "Tasks");
  expect(states()).toEqual({ initial: { opacity: 1, y: 0 }, exit: { opacity: 1, y: 0 } });
  expect(JSON.parse(main().dataset.transition!)).toEqual({ duration: 0 });
});
