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
  // Bar content is 56px tall and only the safe area pads below it.
  expect(nav.className).toContain("h-[calc(3.5rem+env(safe-area-inset-bottom))]");
  expect(nav.className).toContain("pb-[env(safe-area-inset-bottom)]");
});
