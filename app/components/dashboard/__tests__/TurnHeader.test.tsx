// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { TurnHeader } from "~/components/dashboard/TurnHeader";

test('TurnHeader renders "Light · Turn 2 · 5/8 units used"', () => {
  render(<TurnHeader kind="light" turn={2} usedUnits={5} turnSize={8} />);
  expect(screen.getByText("Light · Turn 2 · 5/8 units used")).toBeInTheDocument();
});

test("TurnHeader renders the heavy kind", () => {
  render(<TurnHeader kind="heavy" turn={1} usedUnits={0} turnSize={8} />);
  expect(screen.getByText("Heavy · Turn 1 · 0/8 units used")).toBeInTheDocument();
});

test("TurnHeader with no sections says so", () => {
  render(<TurnHeader kind="light" turn={1} usedUnits={0} turnSize={0} />);
  expect(screen.getByText("No sections yet")).toBeInTheDocument();
});
