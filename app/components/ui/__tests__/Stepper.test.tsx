// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Stepper } from "~/components/ui/Stepper";

function Harness({ initial = 1, min = 1, max = 3 }: { initial?: number; min?: number; max?: number }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <Stepper label="TAs per date" value={v} min={min} max={max} onChange={setV} describedBy="hint" />
      <p id="hint">Each date is covered by this many TAs together.</p>
    </>
  );
}

test("Stepper shows a visible label that names the group and the spinbutton", () => {
  render(<Harness />);
  const label = screen.getByText("TAs per date");
  expect(label).toBeVisible();
  expect(label.id).toBeTruthy();
  const group = screen.getByRole("group", { name: "TAs per date" });
  const spin = screen.getByRole("spinbutton", { name: "TAs per date" });
  expect(group).toHaveAttribute("aria-labelledby", label.id);
  expect(spin).toHaveAttribute("aria-labelledby", label.id);
  expect(spin).toHaveAccessibleDescription("Each date is covered by this many TAs together.");
  expect(group).toHaveAccessibleDescription("Each date is covered by this many TAs together.");
});

test("reaching a bound moves focus from the disabled button to the spinbutton", () => {
  render(<Harness initial={2} />);
  const spin = screen.getByRole("spinbutton", { name: "TAs per date" });
  const inc = screen.getByRole("button", { name: "Increase" });
  inc.focus();
  fireEvent.click(inc);
  expect(inc).toBeDisabled();
  expect(spin).toHaveFocus();
  const dec = screen.getByRole("button", { name: "Decrease" });
  dec.focus();
  fireEvent.click(dec);
  expect(spin).toHaveAttribute("aria-valuenow", "2");
  expect(dec).toHaveFocus();
  fireEvent.click(dec);
  expect(dec).toBeDisabled();
  expect(spin).toHaveFocus();
});

test("Stepper clamps at min and max and is keyboard operable", () => {
  render(<Harness />);
  expect(screen.getByRole("group", { name: "TAs per date" })).toBeInTheDocument();
  const spin = screen.getByRole("spinbutton", { name: "TAs per date" });
  expect(spin).toHaveAttribute("aria-valuenow", "1");
  expect(spin).toHaveAttribute("aria-valuemin", "1");
  expect(spin).toHaveAttribute("aria-valuemax", "3");
  expect(screen.getByRole("button", { name: "Decrease" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(spin).toHaveAttribute("aria-valuenow", "2");
  fireEvent.keyDown(spin, { key: "ArrowUp" });
  expect(spin).toHaveAttribute("aria-valuenow", "3");
  expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
  fireEvent.keyDown(spin, { key: "ArrowUp" });
  expect(spin).toHaveAttribute("aria-valuenow", "3");
  fireEvent.keyDown(spin, { key: "ArrowDown" });
  expect(spin).toHaveAttribute("aria-valuenow", "2");
  fireEvent.keyDown(spin, { key: "Home" });
  expect(spin).toHaveAttribute("aria-valuenow", "1");
  fireEvent.keyDown(spin, { key: "End" });
  expect(spin).toHaveAttribute("aria-valuenow", "3");
  fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
  expect(spin).toHaveAttribute("aria-valuenow", "2");
});
