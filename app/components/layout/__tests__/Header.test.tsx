// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { ThemeProvider } from "~/lib/theme";
import { Header } from "../Header";

const renderAt = (path: string) => {
  const Stub = createRoutesStub([{ path: "*", Component: Header }]);
  return render(
    <ThemeProvider>
      <Stub initialEntries={[path]} />
    </ThemeProvider>,
  );
};

test("header renders three nav regions", async () => {
  const { container } = renderAt("/");
  await screen.findByRole("banner");
  const pills = [...container.querySelectorAll("[data-pill]")].map((el) => el.getAttribute("data-pill"));
  expect(pills).toEqual(["brand", "pages", "actions"]);
  const [brand, pages, actions] = [...container.querySelectorAll<HTMLElement>("[data-pill]")];
  expect(within(brand).getByRole("link", { name: /TA Load/ })).toHaveAttribute("href", "/");
  expect(within(pages).getAllByRole("link").map((a) => a.textContent)).toEqual(["Dashboard", "Team", "Tasks", "Calendar", "History"]);
  expect(within(actions).getByRole("button", { name: "Settings" })).toBeInTheDocument();
  expect(within(actions).getByRole("button", { name: /theme/i })).toBeInTheDocument();
});

test("aria-current on the active pill link", async () => {
  const { container } = renderAt("/tasks");
  await screen.findByRole("banner");
  const pages = container.querySelector<HTMLElement>('[data-pill="pages"]')!;
  const current = within(pages).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
  expect(current.map((a) => a.textContent)).toEqual(["Tasks"]);
});

test("the pills form one centred cluster on desktop: auto-width pills, 12px gaps, no grid", async () => {
  const { container } = renderAt("/");
  await screen.findByRole("banner");
  const row = container.querySelector<HTMLElement>("[data-header-row]")!;
  const cls = row.className.split(/\s+/);
  expect(cls).toEqual(expect.arrayContaining(["flex", "items-center", "gap-3", "md:justify-center"]));
  // Mobile keeps brand at the start and actions at the end.
  expect(cls).toContain("justify-between");
  expect(row.className).not.toMatch(/grid|max-w-6xl/);
  const pills = [...container.querySelectorAll<HTMLElement>("[data-pill]")].map((el) => el.className.split(/\s+/));
  for (const pill of pills) {
    expect(pill.some((c) => c.startsWith("justify-self") || c === "flex-1" || c.startsWith("w-"))).toBe(false);
  }
  expect(pills[1]).toContain("max-md:hidden");
  expect(pills[1]).not.toContain("hidden");
});

test("the header height comes from the shared --header-h variable", async () => {
  renderAt("/");
  expect((await screen.findByRole("banner")).className).toContain("h-(--header-h)");
});
