// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Gauge } from "~/components/ui/Gauge";
test("renders the used percentage", () => {
  render(<Gauge value={2 / 3} color="#f00" label="Dina" />);
  expect(screen.getByLabelText("Dina: 67% used")).toBeInTheDocument();
  expect(screen.getByText("67%")).toBeInTheDocument();
});
test("treats NaN and out-of-range values as clamped", () => {
  const { rerender } = render(<Gauge value={NaN} color="#f00" label="A" />);
  expect(screen.getByText("0%")).toBeInTheDocument();
  expect(screen.getByLabelText("A: 0% used")).toBeInTheDocument();
  rerender(<Gauge value={1.5} color="#f00" label="A" />);
  expect(screen.getByText("100%")).toBeInTheDocument();
  rerender(<Gauge value={-0.2} color="#f00" label="A" />);
  expect(screen.getByText("0%")).toBeInTheDocument();
});
