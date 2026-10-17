// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Sheet } from "~/components/ui/Sheet";
import * as motionLib from "~/lib/motion";
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
/** A matchMedia where only the listed queries match. */
function stubMatchMedia(matching: string[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: matching.includes(q), media: q, addEventListener() {}, removeEventListener() {} }));
}
afterEach(() => vi.unstubAllGlobals());

test("phone sheet is centred and uses the pop variants", () => {
  stubMatchMedia([]);
  render(<Sheet open onClose={() => {}} title="Centred"><p>body</p></Sheet>);
  const panel = screen.getByRole("dialog");
  const container = panel.parentElement!;
  const c = container.className.split(/\s+/);
  expect(c).toEqual(expect.arrayContaining(["fixed", "inset-0", "z-50", "flex", "items-center", "justify-center", "p-4", "md:p-6"]));
  expect(c).not.toContain("items-end");
  const p = panel.className.split(/\s+/);
  expect(p).toEqual(expect.arrayContaining(["rounded-card", "w-full", "max-w-lg", "max-h-[min(90dvh,100%)]"]));
  expect(p).not.toContain("rounded-b-none");
  expect(p).not.toContain("md:rounded-card");
  expect(panel.className).not.toContain("safe-area");
  expect(document.querySelector("[data-sheet-handle]")).toBeNull();
  // First frame = overlayPop(false, 12).initial: faded, scaled to 0.96, 12px low.
  expect(panel.style.opacity).toBe("0");
  expect(panel.style.transform).toContain("translateY(12px)");
  expect(panel.style.transform).toContain("scale(0.96)");
});

test("phone side=\"right\" sheet is a centred card too; desktop keeps the slide-over", () => {
  stubMatchMedia([]);
  const { unmount } = render(<Sheet open side="right" onClose={() => {}} title="Settings"><p>body</p></Sheet>);
  const c = screen.getByRole("dialog").parentElement!.className.split(/\s+/);
  expect(c).toEqual(expect.arrayContaining(["items-center", "justify-center", "p-4", "md:items-stretch", "md:justify-end", "md:p-3"]));
  expect(screen.getByRole("dialog").className.split(/\s+/)).toEqual(expect.arrayContaining(["rounded-card", "md:max-w-md", "md:max-h-none"]));
  unmount();
});

test("desktop centred dialog keeps its classes and the 8px pop", () => {
  stubMatchMedia([motionLib.DESKTOP_QUERY]);
  render(<Sheet open onClose={() => {}} title="Desk"><p>body</p></Sheet>);
  const panel = screen.getByRole("dialog");
  expect(panel.parentElement!.className.split(/\s+/)).toEqual(expect.arrayContaining(["items-center", "justify-center", "md:p-6"]));
  expect(panel.className.split(/\s+/)).toEqual(expect.arrayContaining(["rounded-card", "max-w-lg"]));
  expect(panel.style.transform).toContain("translateY(8px)");
});

test("the bottom-sheet drag helpers are gone", () => {
  const lib = motionLib as Record<string, unknown>;
  expect(lib.touchSpring).toBeUndefined();
  expect(lib.sheetDragElastic).toBeUndefined();
  expect(lib.backdropOpacityFor).toBeUndefined();
});
