// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
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

test("brand mark drops data-hydrating after mount", async () => {
  const { container } = renderAt("/");
  await screen.findByRole("banner");
  expect(container.querySelector(".brand-mark")).not.toBeNull();
  expect(container.querySelector("[data-hydrating]")).toBeNull();
});

describe("pages-pill entrance plays on the first paint only", () => {
  const pagesPill = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-pill="pages"]')!;
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  });

  test("the class is dropped once its own entrance ends, so an md crossing cannot replay it", async () => {
    const { container } = renderAt("/");
    await screen.findByRole("banner");
    const pill = pagesPill(container);
    expect(pill.className).toContain("enter-down");
    // A child's animation bubbling up does not count.
    fireEvent.animationEnd(pill.querySelector("a")!, { bubbles: true });
    expect(pill.className).toContain("enter-down");
    fireEvent.animationEnd(pill);
    expect(pill.className).not.toContain("enter-down");
    expect(pill.className).toContain("max-md:hidden");
  });

  test("a cancelled entrance (pill hidden mid-animation) also drops the class", async () => {
    const { container } = renderAt("/");
    await screen.findByRole("banner");
    fireEvent(pagesPill(container), new Event("animationcancel"));
    expect(pagesPill(container).className).not.toContain("enter-down");
  });

  test("a pill with no running entrance at mount (hidden below md, or already finished) drops it at once", async () => {
    HTMLElement.prototype.getAnimations = () => [];
    const { container } = renderAt("/");
    await screen.findByRole("banner");
    expect(pagesPill(container).className).not.toContain("enter-down");
    // The always-visible pills keep their plain CSS entrance.
    expect(container.querySelector('[data-pill="brand"]')!.className).toContain("enter-down");
  });
});
