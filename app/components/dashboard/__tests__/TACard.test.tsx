// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { TACard } from "~/components/dashboard/TACard";

test("TACard renders two gauges labelled Light and Heavy", () => {
  render(
    <TACard
      ta={{ id: "A", name: "Ahmed", color: "#f00" } as any}
      capacity={4}
      used={{ light: 2, heavy: 1 }}
      counts={{ light: 3, heavy: 1 }}
      totalOccurrences={4}
      nextDates={[]}
      onSwap={() => {}}
    />,
  );
  expect(screen.getByLabelText("Ahmed light: 50% used")).toBeInTheDocument();
  expect(screen.getByLabelText("Ahmed heavy: 25% used")).toBeInTheDocument();
  expect(screen.getByText("3 light · 1 heavy")).toBeInTheDocument();
});
