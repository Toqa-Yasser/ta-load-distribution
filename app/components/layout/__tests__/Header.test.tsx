// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { ThemeProvider } from "~/lib/theme";
import { CONTENT_COLUMN } from "../column";
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

test("the pill row uses the page content column: brand at the start, pages centred, actions at the end", async () => {
  const { container } = renderAt("/");
  await screen.findByRole("banner");
  const column = container.querySelector<HTMLElement>("[data-header-column]")!;
  for (const c of CONTENT_COLUMN.split(" ")) expect(column.className.split(/\s+/)).toContain(c);
  const [brand, pages, actions] = [...container.querySelectorAll<HTMLElement>("[data-pill]")].map((el) => el.className.split(/\s+/));
  expect(brand).toContain("justify-self-start");
  expect(pages).toContain("justify-self-center");
  expect(actions).toContain("justify-self-end");
  expect(pages).toContain("max-md:hidden");
  expect(pages).not.toContain("hidden");
});

test("the header height comes from the shared --header-h variable", async () => {
  renderAt("/");
  expect((await screen.findByRole("banner")).className).toContain("h-(--header-h)");
});
