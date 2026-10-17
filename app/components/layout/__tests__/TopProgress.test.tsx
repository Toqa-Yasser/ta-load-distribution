// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const nav = vi.hoisted(() => ({ state: "idle" as string, fetchers: [] as { state: string; data?: unknown }[] }));
const motionMock = vi.hoisted(() => ({ reduced: false }));

vi.mock("react-router", async (orig) => ({
  ...(await orig<typeof import("react-router")>()),
  useNavigation: () => ({ state: nav.state }),
  useFetchers: () => nav.fetchers,
}));
vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => motionMock.reduced,
}));

import { TopProgress } from "../TopProgress";

const bar = () => screen.queryByRole("progressbar", { name: "Loading" });
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  nav.state = "idle";
  nav.fetchers = [];
  motionMock.reduced = false;
});
afterEach(() => vi.useRealTimers());

function setPending(view: ReturnType<typeof render>, state: string, fetchers: typeof nav.fetchers = []) {
  nav.state = state;
  nav.fetchers = fetchers;
  view.rerender(<TopProgress />);
}

test("progress bar shows after 120ms of pending and completes on idle", () => {
  const view = render(<TopProgress />);
  expect(bar()).toBeNull();
  setPending(view, "loading");
  tick(100);
  expect(bar()).toBeNull();
  tick(30);
  expect(bar()).toHaveAttribute("data-phase", "running");
  setPending(view, "idle");
  expect(bar()).toHaveAttribute("data-phase", "done");
  tick(250);
  expect(bar()).toBeNull();
});

test("a pending that ends before 120ms never shows the bar", () => {
  const view = render(<TopProgress />);
  setPending(view, "loading");
  tick(60);
  setPending(view, "idle");
  tick(300);
  expect(bar()).toBeNull();
});

test("an errored fetcher still completes the bar", () => {
  const view = render(<TopProgress />);
  setPending(view, "idle", [{ state: "submitting" }]);
  tick(130);
  expect(bar()).toHaveAttribute("data-phase", "running");
  setPending(view, "idle", [{ state: "idle", data: { ok: false } }]);
  expect(bar()).toHaveAttribute("data-phase", "done");
  tick(250);
  expect(bar()).toBeNull();
});

test("reduced motion renders a static bar", () => {
  motionMock.reduced = true;
  const view = render(<TopProgress />);
  setPending(view, "loading");
  tick(130);
  expect(bar()).toHaveStyle({ width: "80%" });
  setPending(view, "idle");
  tick(5);
  expect(bar()).toBeNull();
});

test("the bar is indeterminate (no aria-valuenow) and sits above sheet backdrops", () => {
  const view = render(<TopProgress />);
  setPending(view, "loading");
  tick(130);
  expect(bar()).not.toHaveAttribute("aria-valuenow");
  expect(bar()!.className.split(/\s+/)).toContain("z-[60]");
  expect(bar()!.className).not.toMatch(/(^|\s)z-50(\s|$)/);
});

test("pending again during the fade restarts the bar, and the old fade timer does not remove it", () => {
  const view = render(<TopProgress />);
  setPending(view, "loading");
  tick(130);
  setPending(view, "idle");
  expect(bar()).toHaveAttribute("data-phase", "done");
  tick(100);
  setPending(view, "loading");
  expect(bar()).toHaveAttribute("data-phase", "running");
  tick(500);
  expect(bar()).toHaveAttribute("data-phase", "running");
  setPending(view, "idle");
  tick(250);
  expect(bar()).toBeNull();
});

test("toggling reduced motion mid-fade still clears the bar", () => {
  const view = render(<TopProgress />);
  setPending(view, "loading");
  tick(130);
  setPending(view, "idle");
  tick(50);
  motionMock.reduced = true;
  view.rerender(<TopProgress />);
  tick(5);
  expect(bar()).toBeNull();
});

test("aria-busy is set on <body> while pending (outside the inert #app-root), and cleared on idle", () => {
  const view = render(<TopProgress />);
  expect(document.body).not.toHaveAttribute("aria-busy");
  setPending(view, "loading");
  expect(document.body).toHaveAttribute("aria-busy", "true");
  setPending(view, "idle");
  expect(document.body).not.toHaveAttribute("aria-busy");
  setPending(view, "loading");
  view.unmount();
  expect(document.body).not.toHaveAttribute("aria-busy");
});
