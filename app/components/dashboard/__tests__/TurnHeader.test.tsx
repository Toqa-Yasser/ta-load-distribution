// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { TurnHeader } from "~/components/dashboard/TurnHeader";

const tile = () => screen.getByRole("group");

test("TurnHeader is a stat tile: kind, turn, a big used/turnSize numeral and the units caption", () => {
  render(<TurnHeader kind="light" turn={2} usedUnits={5} turnSize={8} />);
  expect(tile()).toHaveAccessibleName("Light turn");
  expect(within(tile()).getByText("Light")).toBeInTheDocument();
  expect(within(tile()).getByText("Turn 2")).toBeInTheDocument();
  expect(within(tile()).getByTestId("turn-numeral")).toHaveTextContent("5/8");
  expect(within(tile()).getByText("units used")).toBeInTheDocument();
});

test("TurnHeader renders the heavy kind", () => {
  render(<TurnHeader kind="heavy" turn={1} usedUnits={0} turnSize={8} />);
  expect(tile()).toHaveAccessibleName("Heavy turn");
  expect(screen.getByText("Turn 1")).toBeInTheDocument();
  expect(screen.getByTestId("turn-numeral")).toHaveTextContent("0/8");
});

test("TurnHeader with no sections says so", () => {
  render(<TurnHeader kind="light" turn={1} usedUnits={0} turnSize={0} />);
  expect(screen.getByText("No sections yet")).toBeInTheDocument();
});

test('TurnHeader says "unit" only when one unit is used', () => {
  render(<TurnHeader kind="light" turn={1} usedUnits={1} turnSize={8} />);
  expect(screen.getByText("unit used")).toBeInTheDocument();
});

test('TurnHeader keeps "units" for 1-unit turns with zero used', () => {
  render(<TurnHeader kind="light" turn={1} usedUnits={0} turnSize={1} />);
  expect(screen.getByText("units used")).toBeInTheDocument();
});

test("the progress strip spans the tile's full width", () => {
  render(<TurnHeader kind="light" turn={1} usedUnits={4} turnSize={8} />);
  const track = screen.getByTestId("turn-strip");
  expect(track.className.split(/\s+/)).toContain("w-full");
  expect(tile().className).not.toMatch(/max-w-/);
});
