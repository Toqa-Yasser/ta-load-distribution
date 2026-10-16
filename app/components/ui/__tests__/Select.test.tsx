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
