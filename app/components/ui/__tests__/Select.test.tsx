// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Select } from "~/components/ui/Select";
import { INPUT_CLASS } from "~/components/ui/input";

// jsdom computes no Tailwind styles, so this pins the classes: an invalid control keeps a danger
// border at rest, and while focused its inset ring (which covers the border) turns danger too.
test.each([
  ["Select", () => render(<Select aria-label="TA" aria-invalid><option>A</option></Select>)],
  ["INPUT_CLASS", () => render(<input aria-label="TA" aria-invalid className={INPUT_CLASS} />)],
])("%s keeps the invalid state visible while focused", (_, ui) => {
  ui();
  const cls = screen.getByLabelText("TA").className.split(/\s+/);
  expect(cls).toContain("aria-[invalid=true]:border-danger");
  expect(cls).toContain("aria-[invalid=true]:focus-visible:outline-danger");
});

// Safari leaves :focus-visible unmatched on a clicked <input type="date">, so text and date fields
// draw the same inset ring on plain :focus too. Select keeps focus-visible only (no ring on click).
test("text and date fields ring on :focus as well as :focus-visible", () => {
  const cls = INPUT_CLASS.split(/\s+/);
  for (const c of ["focus:outline-2", "focus:-outline-offset-2", "focus:outline-accent", "focus:border-transparent", "aria-[invalid=true]:focus:outline-danger"]) {
    expect(cls).toContain(c);
  }
  expect(cls).toContain("focus-visible:outline-accent");
  render(<Select aria-label="Pick"><option>A</option></Select>);
  expect(screen.getByLabelText("Pick").className).not.toMatch(/(^|\s)focus:/);
});
