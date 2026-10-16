// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Timeline } from "~/components/dashboard/Timeline";

test("Timeline shows only the next 14 days", () => {
  const tasks = [{ id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [
    { id: "1", date: "2026-10-17", taId: "A", turn: 1 }, { id: "2", date: "2026-11-30", taId: "A", turn: 1 }] }];
  render(<Timeline tasks={tasks as any} taById={new Map([["A", { id: "A", name: "Ahmed", color: "#f00" }]])} today="2026-10-16" />);
  expect(screen.getByText("Oct 17")).toBeInTheDocument();
  expect(screen.queryByText("Nov 30")).not.toBeInTheDocument();
});
