// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useStepFocus } from "~/lib/focus";

function Steps() {
  const [step, setStep] = useState(0);
  const focus = useStepFocus();
  const go = (n: number) => {
    focus.request();
    setStep(n);
  };
  return (
    <div role="dialog" tabIndex={-1}>
      <div key={step} ref={focus.ref}>
        {step === 0 && <input aria-label="title" />}
        {step === 1 && (
          <>
            <button type="button">plain</button>
            <input aria-label="date" data-autofocus />
          </>
        )}
        {step === 2 && <p>nothing to focus</p>}
      </div>
      <button type="button" onClick={() => go(step + 1)}>
        next {step}
      </button>
    </div>
  );
}

test("does not move focus on the first mount", () => {
  render(<Steps />);
  expect(document.activeElement).toBe(document.body);
});
test("focuses the new step's data-autofocus element, else falls back to the dialog", () => {
  render(<Steps />);
  fireEvent.click(screen.getByRole("button", { name: "next 0" }));
  expect(document.activeElement).toBe(screen.getByLabelText("date"));
  fireEvent.click(screen.getByRole("button", { name: "next 1" }));
  expect(document.activeElement).toBe(screen.getByRole("dialog"));
});
