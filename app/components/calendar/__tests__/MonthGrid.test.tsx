// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthGrid } from "~/components/calendar/MonthGrid";

test("clicking a pill while in swap mode selects the target", () => {
  const onSelect = vi.fn();
  const tasks = [{ id: "t", title: "Quiz", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [
    { id: "1", date: "2026-10-05", taId: "A", turn: 1 }, { id: "2", date: "2026-10-06", taId: "A", turn: 1 }] }];
  render(<MonthGrid yearMonth="2026-10" tasks={tasks as any} taById={new Map([["A", { id: "A", name: "Ahmed", color: "#f00" }]])}
    selected={null} swapSource={{ taskId: "t", occurrenceId: "1" }} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: /Quiz.*Oct 6/i }));
  expect(onSelect).toHaveBeenCalledWith({ taskId: "t", occurrenceId: "2" });
});
