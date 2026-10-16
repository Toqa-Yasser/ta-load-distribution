// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { TurnHeader } from "~/components/dashboard/TurnHeader";

test("TurnHeader shows turn and units", () => {
  render(<TurnHeader turn={2} usedUnits={5} turnSize={8} />);
  expect(screen.getByText("Turn 2 · 5/8 units used")).toBeInTheDocument();
});
