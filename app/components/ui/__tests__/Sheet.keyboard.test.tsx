// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler, useState } from "react";
import { Sheet, SheetFooter } from "~/components/ui/Sheet";
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

test("footer renders outside the scroll body", () => {
  render(
    <Sheet open onClose={() => {}} title="Sure?" footer={<button type="button">Go</button>}>
      <p>body</p>
    </Sheet>,
  );
  const body = document.querySelector<HTMLElement>(".overflow-y-auto")!;
  const footer = document.querySelector<HTMLElement>("[data-sheet-footer]")!;
  expect(body).toContainElement(screen.getByText("body"));
  expect(footer).toContainElement(screen.getByRole("button", { name: "Go" }));
  expect(body.contains(footer)).toBe(false);
  expect(footer.parentElement).toBe(body.parentElement);
  expect(footer.hidden).toBe(false);
});

test("SheetFooter from inside the body renders into the footer slot", () => {
  render(
    <Sheet open onClose={() => {}} title="Wizard">
      <p>step</p>
      <SheetFooter>
        <button type="button">Next</button>
      </SheetFooter>
    </Sheet>,
  );
  const body = document.querySelector<HTMLElement>(".overflow-y-auto")!;
  const footer = document.querySelector<HTMLElement>("[data-sheet-footer]")!;
  expect(footer).toContainElement(screen.getByRole("button", { name: "Next" }));
  expect(body.contains(screen.getByRole("button", { name: "Next" }))).toBe(false);
  expect(footer.hidden).toBe(false);
});

test("a sheet without a footer keeps the slot hidden", () => {
  render(<Sheet open onClose={() => {}} title="Plain"><p>body</p></Sheet>);
  expect(document.querySelector<HTMLElement>("[data-sheet-footer]")?.hidden ?? true).toBe(true);
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

test("two-button footers share one row class: equal flex shares that never wrap their labels", async () => {
  const { SHEET_ACTIONS } = await import("~/components/ui/Sheet");
  const cls = SHEET_ACTIONS.split(/\s+/);
  expect(cls).toEqual(expect.arrayContaining(["flex", "*:flex-1", "*:whitespace-nowrap", "sm:justify-end", "sm:*:flex-none"]));
  expect(cls).not.toContain("grid-cols-2");
  const { ConfirmDialog } = await import("~/components/ui/ConfirmDialog");
  render(<ConfirmDialog open title="Remove?" body="x" confirmLabel="Remove" onConfirm={() => {}} onClose={() => {}} />);
  expect(screen.getByRole("button", { name: "Remove" }).parentElement!.className).toBe(SHEET_ACTIONS);
});
