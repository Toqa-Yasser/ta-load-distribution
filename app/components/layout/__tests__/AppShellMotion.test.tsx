// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createRoutesStub, Link } from "react-router";
import { Fab, FAB_SLOT_ID } from "~/components/ui/Fab";
import { pageTransition, phonePageTransition } from "~/lib/motion";
import { AppShell } from "../AppShell";

const state = vi.hoisted(() => ({ phone: false, reduced: false, pending: false, presence: [] as Record<string, unknown>[] }));

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
    // Records the props it gets: `custom` must reach AnimatePresence so the exiting page uses it.
    AnimatePresence: ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => {
      state.presence.push(props);
      return <>{children}</>;
    },
    // motion is a Proxy (spreading it copies nothing); keep every other element real.
    motion: new Proxy(actual.motion, { get: (target, key) => (key === "main" ? Main : Reflect.get(target, key)) }),
  };
});
vi.mock("../Header", () => ({ Header: () => null }));
vi.mock("../NavBar", () => ({ NavBar: () => null }));
vi.mock("../Background", () => ({ Background: () => null }));
vi.mock("../SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("../CommandToasts", () => ({ CommandToasts: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("~/lib/use-pending", () => ({ usePendingGlobal: () => state.pending }));
vi.mock("../TopProgress", () => ({ TopProgress: () => null }));
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
  state.presence = [];
  state.pending = false;
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

test("the slide direction is passed to AnimatePresence as `custom`, so the exiting page leaves the same way", async () => {
  state.phone = true;
  renderShell();
  await screen.findByRole("heading", { name: "Dashboard" });
  await go("to tasks", "Tasks");
  expect(state.presence.at(-1)).toMatchObject({ custom: 1, mode: "wait", initial: false });
  await go("to dashboard", "Dashboard");
  expect(state.presence.at(-1)).toMatchObject({ custom: -1 });
});

test("a page's Fab lands in #fab-slot outside <main>, fixed above the tab bar", async () => {
  state.phone = true;
  const Stub = createRoutesStub([
    { Component: AppShell, children: [{ path: "/", Component: () => <Fab label="New task" onClick={() => {}}>+</Fab> }] },
  ]);
  render(<Stub initialEntries={["/"]} />);
  const fab = await screen.findByRole("button", { name: "New task" });
  expect(fab.parentElement!.id).toBe(FAB_SLOT_ID);
  expect(main().contains(fab)).toBe(false);
  const cls = fab.className.split(/\s+/);
  expect(cls).toEqual(
    expect.arrayContaining(["fixed", "right-4", "z-40", "md:hidden", "bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem+0.75rem)]"]),
  );
});

test("<main> is aria-busy only while a navigation or command is pending", async () => {
  const view = renderShell();
  await screen.findByRole("heading", { name: "Dashboard" });
  expect(main()).not.toHaveAttribute("aria-busy");
  state.pending = true;
  await go("to tasks", "Tasks");
  expect(main()).toHaveAttribute("aria-busy", "true");
  state.pending = false;
  await go("to dashboard", "Dashboard");
  expect(main()).not.toHaveAttribute("aria-busy");
  view.unmount();
});
