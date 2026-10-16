import { resolveTheme, THEME_INIT_SCRIPT } from "~/lib/theme";
test("system follows the OS preference, explicit prefs win", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
});
test("init script sets data-theme from localStorage", () => {
  expect(THEME_INIT_SCRIPT).toContain("localStorage");
  expect(THEME_INIT_SCRIPT).toContain("data-theme");
});
