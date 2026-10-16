// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "~/components/ui/Sheet";
test("closes on Escape", () => {
  const onClose = vi.fn();
  render(<Sheet open onClose={onClose} title="Hi"><p>body</p></Sheet>);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});
