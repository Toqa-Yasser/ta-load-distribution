// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
