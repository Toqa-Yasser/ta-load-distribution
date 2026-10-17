// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { ThemeProvider } from "~/lib/theme";

// The `dark` variant keys off [data-theme=dark] (app.css), so these classes decide the visible icon.
const classes = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

test("on the initial render in dark mode the moon is the visible icon, chosen by CSS, not by state", () => {
  document.documentElement.dataset.theme = "dark"; // set by the init script before hydration
  // The first render (as during hydration) has not synced theme state yet.
  const html = renderToString(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  const box = document.createElement("div");
  box.innerHTML = html;
  const sun = box.querySelector('[data-icon="sun"]');
  const moon = box.querySelector('[data-icon="moon"]');
  expect(classes(sun)).toContain("dark:hidden");
  expect(classes(moon)).toEqual(expect.arrayContaining(["hidden", "dark:block"]));
});

test("both icons share one box and the markup does not depend on the theme", () => {
  document.documentElement.dataset.theme = "light";
  const light = renderToString(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  document.documentElement.dataset.theme = "dark";
  const dark = renderToString(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  expect(dark).toBe(light);
  const box = document.createElement("div");
  box.innerHTML = dark;
  for (const icon of box.querySelectorAll("[data-icon]")) expect(classes(icon)).toContain("size-5");
});

test("clicking still toggles the theme", () => {
  document.documentElement.dataset.theme = "light";
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  act(() => screen.getByRole("button", { name: /switch to dark theme/i }).click());
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
});
