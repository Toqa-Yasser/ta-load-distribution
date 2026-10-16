// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomDatesEditor } from "~/components/tasks/CustomDatesEditor";

test("Generate fills count dates spaced by gap", () => {
  const onChange = vi.fn();
  render(<CustomDatesEditor start="2026-10-01" count={3} gapDays={10} dates={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /generate/i }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dates: ["2026-10-01", "2026-10-11", "2026-10-21"] }));
});

test("How many shows the clamped value as soon as it is typed", () => {
  render(<CustomDatesEditor start="2026-10-01" count={5} gapDays={7} dates={[]} onChange={() => {}} />);
  const input = screen.getByLabelText("How many") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "900" } });
  expect(input.value).toBe("500");
  fireEvent.change(input, { target: { value: "" } });
  expect(input.value).toBe("");
});
