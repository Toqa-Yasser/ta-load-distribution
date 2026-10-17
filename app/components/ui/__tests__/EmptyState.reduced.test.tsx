// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { EmptyState } from "~/components/ui/EmptyState";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

test("a client-side mount under reduced motion starts fully visible (no opacity tween)", () => {
  // render() mounts after hydration, like a client navigation, so useHydrated() is true.
  render(<EmptyState icon={<svg />} title="Nothing here" body="Add something" />);
  const box = screen.getByRole("heading", { name: "Nothing here" }).parentElement!;
  expect(box.style.opacity).not.toBe("0");
  expect(box.getAttribute("style") ?? "").not.toMatch(/opacity:\s*0(?![.\d])/);
  const icon = box.firstElementChild as HTMLElement;
  expect(icon.getAttribute("style") ?? "").not.toMatch(/scale\(0\.8\)/);
});
