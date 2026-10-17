// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler, useState } from "react";
import { Sheet } from "~/components/ui/Sheet";
import { useStepFocus } from "~/lib/focus";

/** A matchMedia where only the listed queries match. */
function stubMatchMedia(matching: string[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: matching.includes(q),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

const withInput = (
  <label>
    Title
    <input data-autofocus />
  </label>
);

test("on a coarse pointer the sheet focuses its heading and no input", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  render(<Sheet open onClose={() => {}} title="New task">{withInput}</Sheet>);
  const heading = screen.getByRole("heading", { name: "New task" });
  expect(document.activeElement).toBe(heading);
  expect(heading).toHaveAttribute("tabindex", "-1");
  expect(document.activeElement?.tagName).not.toBe("INPUT");
});

test("on a fine pointer data-autofocus is honoured", () => {
  stubMatchMedia(["(pointer: fine)"]);
  render(<Sheet open onClose={() => {}} title="New task">{withInput}</Sheet>);
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Title" }));
});

test("action rows render at the end of the scroll body: no pinned footer", async () => {
  const { ConfirmDialog } = await import("~/components/ui/ConfirmDialog");
  render(<ConfirmDialog open title="Remove?" body="Gone for good." confirmLabel="Remove" onConfirm={() => {}} onClose={() => {}} />);
  const body = document.querySelector<HTMLElement>(".overflow-y-auto")!;
  const row = screen.getByRole("button", { name: "Remove" }).parentElement!;
  expect(body).toContainElement(row);
  expect(row.nextElementSibling).toBeNull(); // last in the body content
  expect(document.querySelector("[data-sheet-footer]")).toBeNull();
  // The body keeps its bottom padding, and the panel the safe area.
  expect(body.className.split(/\s+/)).toContain("pb-5");
  expect(screen.getByRole("dialog").className).toContain("pb-[env(safe-area-inset-bottom)]");
});

test("the password dialog's buttons sit inside its form, in the body", async () => {
  const { PasswordDialog } = await import("~/components/history/PasswordDialog");
  render(<PasswordDialog open onClose={() => {}} onSubmit={async () => true} error={undefined} pending={false} />);
  const body = document.querySelector<HTMLElement>(".overflow-y-auto")!;
  const submit = screen.getByRole("button", { name: "Delete all history" });
  expect(body).toContainElement(submit);
  expect(submit.closest("form")).not.toBeNull();
  expect(submit).not.toHaveAttribute("form");
});

test("Sheet no longer exports SheetFooter", async () => {
  const mod = await import("~/components/ui/Sheet");
  expect("SheetFooter" in mod).toBe(false);
});

function Steps() {
  const [step, setStep] = useState(0);
  const focus = useStepFocus();
  return (
    <>
      <div key={step} ref={focus.ref}>
        {step === 1 && <input aria-label="Field" data-autofocus />}
        <button type="button">Option</button>
      </div>
      <button
        type="button"
        onClick={() => {
          focus.request();
          setStep(1);
        }}
      >
        Step
      </button>
    </>
  );
}

test("on a coarse pointer a step change focuses no text field", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  render(<Sheet open onClose={() => {}} title="Steps"><Steps /></Sheet>);
  fireEvent.click(screen.getByRole("button", { name: "Step" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Option" }));
});

test("on a fine pointer a step change focuses its data-autofocus field", () => {
  stubMatchMedia([]);
  render(<Sheet open onClose={() => {}} title="Steps"><Steps /></Sheet>);
  fireEvent.click(screen.getByRole("button", { name: "Step" }));
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Field" }));
});

test("where the keyboard only shrinks the visual viewport, the sheet fits the visible region", () => {
  vi.stubGlobal("visualViewport", { height: 400, offsetTop: 0, scale: 1, addEventListener() {}, removeEventListener() {} });
  render(<Sheet open onClose={() => {}} title="Fit"><p>body</p></Sheet>);
  const container = screen.getByRole("dialog").parentElement!;
  expect(container.style.height).toBe("400px");
  expect(container.style.top).toBe("0px");
});

test("a pinch-zoomed visual viewport leaves the sheet alone", () => {
  vi.stubGlobal("visualViewport", { height: 400, offsetTop: 0, scale: 2, addEventListener() {}, removeEventListener() {} });
  render(<Sheet open onClose={() => {}} title="Zoom"><p>body</p></Sheet>);
  expect(screen.getByRole("dialog").parentElement!.style.height).toBe("");
});

test("Shift+Tab from the focused heading wraps to the last control instead of leaving the sheet", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  render(
    <>
      <button type="button">Outside</button>
      <Sheet open onClose={() => {}} title="Trap">
        <button type="button">Inner</button>
      </Sheet>
    </>,
  );
  const heading = screen.getByRole("heading", { name: "Trap" });
  expect(document.activeElement).toBe(heading);
  const ev = fireEvent.keyDown(heading, { key: "Tab", shiftKey: true });
  expect(ev).toBe(false); // default prevented: the browser does not move focus out
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Inner" }));
});

describe("keyboard fit updates", () => {
  type Listener = () => void;
  function stubViewport(init: { height: number; offsetTop: number }) {
    const vv = { ...init, scale: 1, listeners: [] as Listener[], addEventListener: (_: string, l: Listener) => vv.listeners.push(l), removeEventListener() {} };
    vi.stubGlobal("visualViewport", vv);
    return vv;
  }
  function stubFrames() {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    return () => act(() => queue.splice(0).forEach((cb) => cb(0)));
  }

  test("a burst of viewport events is applied once, on the next frame", () => {
    const vv = stubViewport({ height: 400, offsetTop: 0 });
    const flush = stubFrames();
    render(<Sheet open onClose={() => {}} title="Fit"><p>body</p></Sheet>);
    const container = () => screen.getByRole("dialog").parentElement!;
    expect(container().style.height).toBe("400px");
    act(() => {
      for (const h of [390, 380, 370]) {
        vv.height = h;
        vv.listeners.forEach((l) => l());
      }
    });
    expect(container().style.height).toBe("400px");
    flush();
    expect(container().style.height).toBe("370px");
  });

  test("events that leave the fitted region unchanged do not re-render the sheet", () => {
    const vv = stubViewport({ height: 400, offsetTop: 0 });
    const flush = stubFrames();
    let commits = 0;
    render(
      <Profiler id="sheet" onRender={() => (commits += 1)}>
        <Sheet open onClose={() => {}} title="Fit"><p>body</p></Sheet>
      </Profiler>,
    );
    flush();
    const before = commits;
    for (let i = 0; i < 3; i++) {
      act(() => vv.listeners.forEach((l) => l()));
      flush();
    }
    expect(commits).toBe(before);
  });
});

test("two-button action rows share one row class: equal flex shares that never wrap their labels", async () => {
  const { SHEET_ACTIONS } = await import("~/components/ui/Sheet");
  const cls = SHEET_ACTIONS.split(/\s+/);
  expect(cls).toEqual(expect.arrayContaining(["flex", "*:flex-1", "*:whitespace-nowrap", "sm:justify-end", "sm:*:flex-none"]));
  expect(cls).not.toContain("grid-cols-2");
  const { ConfirmDialog } = await import("~/components/ui/ConfirmDialog");
  render(<ConfirmDialog open title="Remove?" body="x" confirmLabel="Remove" onConfirm={() => {}} onClose={() => {}} />);
  expect(screen.getByRole("button", { name: "Remove" }).parentElement!.className).toBe(SHEET_ACTIONS);
});

test("the panel drops its safe-area bottom padding while the keyboard fit is active", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = { height: 500, scale: 1, offsetTop: 0, addEventListener() {}, removeEventListener() {} };
  vi.stubGlobal("visualViewport", vv);
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  render(<Sheet open onClose={() => {}} title="New task"><p>x</p></Sheet>);
  const panel = screen.getByRole("dialog");
  expect(panel).toHaveAttribute("data-keyboard-fit");
  expect(panel.className).not.toContain("pb-[env(safe-area-inset-bottom)]");
});

test("without a keyboard fit the panel keeps the safe-area bottom padding", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  vi.stubGlobal("visualViewport", { height: 800, scale: 1, offsetTop: 0, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  render(<Sheet open onClose={() => {}} title="New task"><p>x</p></Sheet>);
  const panel = screen.getByRole("dialog");
  expect(panel).not.toHaveAttribute("data-keyboard-fit");
  expect(panel.className).toContain("pb-[env(safe-area-inset-bottom)]");
});
