// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Gauge } from "~/components/ui/Gauge";
test("renders the used percentage", () => {
  render(<Gauge value={2 / 3} color="#f00" label="Dina" />);
  expect(screen.getByLabelText("Dina: 67% used")).toBeInTheDocument();
  expect(screen.getByText("67%")).toBeInTheDocument();
});
