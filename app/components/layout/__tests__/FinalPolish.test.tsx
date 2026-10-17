// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { emptyWorkspace } from "~/engine/empty";
import { ThemeProvider } from "~/lib/theme";
import { ToastProvider } from "~/lib/toast";
import { Toaster, useToast } from "~/components/ui/Toast";
import { AppShell } from "../AppShell";
import { NavBar } from "../NavBar";

const css = readFileSync(`${process.cwd()}/app/app.css`, "utf8");
const squash = (s: string) => s.replace(/\s+/g, " ");

function Pusher() {
  const toast = useToast();
  return <button onClick={() => toast({ message: "Saved" })}>push</button>;
}

test("toast stack clears the FAB via --fab-clear, defined in app.css", () => {
  render(<ToastProvider><Pusher /><Toaster /></ToastProvider>);
  const live = document.querySelector('[aria-live="polite"]')!;
  expect(live.className).toContain("var(--fab-clear)");
  const c = squash(css);
  expect(c).toContain("--fab-clear: 0px");
  expect(c).toMatch(/:root:has\(#fab-slot > \*\) \{ --fab-clear: 4\.25rem;/);
});

const kb = vi.hoisted(() => ({ open: false }));
vi.mock("~/lib/use-keyboard-open", () => ({ useKeyboardOpen: () => kb.open }));

test("tab bar and FAB hide while the keyboard is up (data-keyboard-open), not on focus", () => {
  const c = squash(css);
  // No focus-based rule left: an Android back press closes the keyboard but keeps the focus.
  expect(c).not.toMatch(/:focus\) \{ --fab-clear/);
  expect(c).not.toContain("[contenteditable=true]):focus");
  expect(c).toContain("#app-root[data-keyboard-open] :is([data-tabbar], #fab-slot) { display: none; }");
  // Outranks :root:has(#fab-slot > *), so the hidden FAB is no longer cleared by the toasts.
  expect(c).toContain(":root:has(#app-root[data-keyboard-open]) { --fab-clear: 0px; }");
  // Fields scrolled into view still clear the tab bar.
  expect(c).toContain("scroll-padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 1rem)");
});

function renderShell() {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ workspace: emptyWorkspace(), version: 1, today: "2026-10-17", appUrl: "https://x.edu" }),
      children: [{ path: "*", Component: () => <h1>Page</h1> }],
    },
  ]);
  return render(<ThemeProvider><ToastProvider><Stub initialEntries={["/team"]} /></ToastProvider></ThemeProvider>);
}

test("#app-root carries data-keyboard-open only while the keyboard is up", async () => {
  kb.open = true;
  const first = renderShell();
  await screen.findByRole("banner");
  expect(document.getElementById("app-root")).toHaveAttribute("data-keyboard-open");
  first.unmount();
  kb.open = false;
  renderShell();
  await screen.findByRole("banner");
  expect(document.getElementById("app-root")).not.toHaveAttribute("data-keyboard-open");
  const Stub = createRoutesStub([{ path: "*", Component: () => <NavBar placement="bottom" /> }]);
  const { container } = render(<Stub initialEntries={["/"]} />);
  expect(container.querySelector("nav[data-tabbar]")).not.toBeNull();
});

test("#app-root clips horizontal overflow", async () => {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ workspace: emptyWorkspace(), version: 1, today: "2026-10-17", appUrl: "https://x.edu" }),
      children: [{ path: "*", Component: () => <h1>Page</h1> }],
    },
  ]);
  render(<ThemeProvider><ToastProvider><Stub initialEntries={["/team"]} /></ToastProvider></ThemeProvider>);
  await screen.findByRole("banner");
  expect(document.getElementById("app-root")!.className.split(/\s+/)).toContain("overflow-x-clip");
  void fireEvent;
});
