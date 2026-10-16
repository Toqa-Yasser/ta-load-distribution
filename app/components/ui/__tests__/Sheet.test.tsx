// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Sheet } from "~/components/ui/Sheet";
test("closes on Escape", () => {
  const onClose = vi.fn();
  render(<Sheet open onClose={onClose} title="Hi"><p>body</p></Sheet>);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});
test("ConfirmDialog returns focus to the opener on close", () => {
  const ui = (open: boolean) => (
    <>
      <button type="button">opener</button>
      <ConfirmDialog open={open} title="Delete?" body="Sure?" confirmLabel="Delete" onConfirm={() => {}} onClose={() => {}} />
    </>
  );
  const { rerender } = render(ui(false));
  const opener = screen.getByRole("button", { name: "opener" });
  opener.focus();
  rerender(ui(true));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete" }));
  rerender(ui(false));
  expect(document.activeElement).toBe(opener);
});
