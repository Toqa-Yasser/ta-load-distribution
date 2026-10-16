// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { INSTANT_DRAG, Sheet } from "~/components/ui/Sheet";
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
test("a ConfirmDialog stacked on an open Sheet restores focus and scroll lock in order", () => {
  const ui = (outer: boolean, inner: boolean) => (
    <>
      <button type="button">opener</button>
      <Sheet open={outer} onClose={() => {}} title="Settings">
        <button type="button">danger</button>
      </Sheet>
      <ConfirmDialog open={inner} title="Sure?" body="" confirmLabel="Go" onConfirm={() => {}} onClose={() => {}} />
    </>
  );
  const { rerender } = render(ui(false, false));
  const opener = screen.getByRole("button", { name: "opener" });
  opener.focus();
  rerender(ui(true, false));
  const danger = screen.getByRole("button", { name: "danger" });
  danger.focus();
  rerender(ui(true, true));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Go" }));
  expect(document.body.style.overflow).toBe("hidden");
  rerender(ui(true, false));
  expect(document.activeElement).toBe(danger);
  expect(document.body.style.overflow).toBe("hidden");
  rerender(ui(false, false));
  expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).toBe("");
});

const appRoot = () => document.getElementById("app-root")!;
const withRoot = (children: React.ReactNode) => <div id="app-root">{children}</div>;

test("marks the app root inert while open and clears it after close", () => {
  const { rerender } = render(withRoot(<Sheet open={false} onClose={() => {}} title="Hi"><p>body</p></Sheet>));
  expect(appRoot()).not.toHaveAttribute("inert");
  rerender(withRoot(<Sheet open onClose={() => {}} title="Hi"><p>body</p></Sheet>));
  expect(appRoot()).toHaveAttribute("inert");
  expect(appRoot().contains(screen.getByRole("dialog"))).toBe(false);
  rerender(withRoot(<Sheet open={false} onClose={() => {}} title="Hi"><p>body</p></Sheet>));
  expect(appRoot()).not.toHaveAttribute("inert");
});
test("two stacked sheets: the app root stays inert until both are closed", () => {
  const ui = (a: boolean, b: boolean) =>
    withRoot(
      <>
        <Sheet open={a} onClose={() => {}} title="A"><p>a</p></Sheet>
        <Sheet open={b} onClose={() => {}} title="B"><p>b</p></Sheet>
      </>,
    );
  const { rerender } = render(ui(true, false));
  rerender(ui(true, true));
  expect(appRoot()).toHaveAttribute("inert");
  rerender(ui(false, true));
  expect(appRoot()).toHaveAttribute("inert");
  rerender(ui(false, false));
  expect(appRoot()).not.toHaveAttribute("inert");
});
test("focus escaping to the body is pulled back into the panel", async () => {
  render(<Sheet open onClose={() => {}} title="Hi"><button type="button">inside</button></Sheet>);
  const inside = screen.getByRole("button", { name: "inside" });
  inside.focus();
  inside.blur();
  expect(document.activeElement).toBe(document.body);
  await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
});
test("focus escaping from a lower stacked sheet is recovered into the topmost sheet", async () => {
  render(
    <>
      <Sheet open onClose={() => {}} title="Lower"><button type="button">lower</button></Sheet>
      <Sheet open onClose={() => {}} title="Upper"><button type="button">upper</button></Sheet>
    </>,
  );
  const lower = screen.getByRole("button", { name: "lower" });
  lower.focus();
  lower.blur();
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Upper" }).contains(document.activeElement)).toBe(true));
});
test("reduced motion: the drag release jumps back without a spring", () => {
  expect(INSTANT_DRAG).toEqual({ type: false });
});
