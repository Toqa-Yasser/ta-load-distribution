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

const TEXT_INPUTS =
  "input:is([type=text],[type=search],[type=email],[type=url],[type=tel],[type=password],[type=number],[type=date],[type=time],[type=datetime-local],[type=month],[type=week],:not([type]))";
const FOCUS = `:root:has(#app-root :is(${TEXT_INPUTS}, textarea, [contenteditable=true]):focus)`;

test("tab bar hides under an in-page text field on coarse pointers; sheets unaffected", () => {
  const c = squash(css);
  expect(c).toContain("@media (pointer: coarse)");
  // One combined rule: hiding the bar/FAB and dropping the toast's FAB offset share a condition.
  expect(c).toContain(`${FOCUS} { --fab-clear: 0px; & :is([data-tabbar], #fab-slot) { display: none; } }`);
  for (const t of ["button", "file", "checkbox", "radio", "range", "submit"]) expect(c).not.toContain(`[type=${t}]`);
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
