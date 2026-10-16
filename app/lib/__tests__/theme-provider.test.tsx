// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "~/lib/theme";

function Consumer({ name }: { name: string }) {
  const { pref, setPref } = useTheme();
  return (
    <button type="button" data-testid={name} onClick={() => setPref("dark")}>
      {pref}
    </button>
  );
}

test("ThemeProvider shares pref between two consumers", () => {
  render(
    <ThemeProvider>
      <Consumer name="a" />
      <Consumer name="b" />
    </ThemeProvider>,
  );
  act(() => screen.getByTestId("a").click());
  expect(screen.getByTestId("b")).toHaveTextContent("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
});
