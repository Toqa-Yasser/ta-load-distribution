// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { emptyWorkspace } from "~/engine/empty";
import { ThemeProvider } from "~/lib/theme";
import { ToastProvider } from "~/lib/toast";
import { AppShell } from "../AppShell";
import { NavBar } from "../NavBar";

const renderShell = (path: string) => {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      Component: AppShell,
      loader: () => ({ workspace: emptyWorkspace(), version: 1, today: "2026-10-17", appUrl: "https://x.edu" }),
      children: [{ path: "*", Component: () => <h1>Page</h1> }],
    },
  ]);
  return render(
    <ThemeProvider>
      <ToastProvider>
        <Stub initialEntries={[path]} />
      </ToastProvider>
    </ThemeProvider>,
  );
};

const renderBar = (path: string) => {
  const Stub = createRoutesStub([{ path: "*", Component: () => <NavBar placement="bottom" /> }]);
  return render(<Stub initialEntries={[path]} />);
};

test("mobile header pills are 44px and the main offset is header + 16px", async () => {
  const { container } = renderShell("/team");
  await screen.findByRole("banner");
  const brand = container.querySelector<HTMLElement>('[data-pill="brand"]')!.className.split(/\s+/);
  const actions = container.querySelector<HTMLElement>('[data-pill="actions"]')!.className.split(/\s+/);
  for (const pill of [brand, actions]) {
    expect(pill).toContain("h-11");
    // Desktop keeps its 48px pills.
    expect(pill).toContain("md:h-12");
  }
  const main = container.querySelector<HTMLElement>("main")!.className.split(/\s+/);
  expect(main).toContain("pt-[calc(var(--header-h)+1rem)]");
  expect(main).toContain("md:pt-[calc(var(--header-h)+2rem)]");
  // Below md it clears the floating tab bar (12px offset + bar + safe area) by 16px; desktop keeps 48px.
  expect(main).toContain("pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.75rem)]");
  expect(main).toContain("md:pb-12");
});

test("active tab renders the sliding indicator with aria-current", async () => {
  renderBar("/calendar");
  const nav = await screen.findByRole("navigation", { name: "Primary" });
  const indicators = nav.querySelectorAll("[data-tab-indicator]");
  expect(indicators).toHaveLength(1);
  const current = within(nav).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
  expect(current.map((a) => a.textContent)).toEqual(["Calendar"]);
  expect(current[0]).toContainElement(indicators[0] as HTMLElement);
});

test("tab items have press feedback props", async () => {
  renderBar("/");
  const nav = await screen.findByRole("navigation", { name: "Primary" });
  const links = within(nav).getAllByRole("link");
  expect(links).toHaveLength(5);
  for (const link of links) {
    expect(link.querySelector('[data-press="tab"]')).not.toBeNull();
    expect(link.querySelector("span")!.className).toContain("text-[11px]");
  }
});

test("the bar is exactly --tabbar-h tall and the safe area goes into its offset from the edge", async () => {
  renderBar("/");
  const nav = await screen.findByRole("navigation", { name: "Primary" });
  const cls = nav.className.split(/\s+/);
  expect(cls).toContain("h-(--tabbar-h)");
  expect(cls).toContain("bottom-[calc(0.75rem+env(safe-area-inset-bottom))]");
  // No inner band under the labels where a browser reports a gesture-bar inset (Chrome Android).
  expect(nav.className).not.toMatch(/(^|\s)pb-|h-\[calc/);
  expect(cls).not.toContain("bottom-3");
});

test("each tab's indicator covers its whole hit box (icon and label) with 4px to spare", async () => {
  renderBar("/");
  const nav = await screen.findByRole("navigation", { name: "Primary" });
  const indicator = nav.querySelector<HTMLElement>("[data-tab-indicator]")!;
  const item = indicator.closest<HTMLElement>('[data-press="tab"]')!;
  expect(item).not.toBeNull();
  expect(indicator.parentElement).toBe(item);
  const ind = indicator.className.split(/\s+/);
  expect(ind).toEqual(expect.arrayContaining(["absolute", "inset-1", "-z-10"]));
  expect(ind.some((c) => c.startsWith("inset-x-") || c.startsWith("inset-y-"))).toBe(false);
  for (const link of within(nav).getAllByRole("link")) {
    // Content-sized: a long label gets more width than a short one.
    expect(link.className.split(/\s+/)).toEqual(expect.arrayContaining(["min-w-0", "flex-auto"]));
    const tab = link.querySelector<HTMLElement>('[data-press="tab"]')!.className.split(/\s+/);
    expect(tab).toEqual(expect.arrayContaining(["h-full", "px-2", "whitespace-nowrap", "text-[11px]", "max-[22.5rem]:text-[10px]"]));
  }
});
