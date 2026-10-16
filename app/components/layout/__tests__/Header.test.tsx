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
