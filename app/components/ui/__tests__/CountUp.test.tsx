// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { CountUp } from "~/components/ui/CountUp";

test("CountUp hides the animated digits from assistive tech and exposes the final value", () => {
  const { container, rerender } = render(<CountUp value={3} />);
  rerender(<CountUp value={12} />);
  const hidden = container.querySelector("[aria-hidden]");
  expect(hidden).not.toBeNull();
  const sr = container.querySelector(".sr-only");
  expect(sr?.textContent).toBe("12");
  expect(sr?.closest("[aria-hidden]")).toBeNull();
});
