// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthGrid } from "~/components/calendar/MonthGrid";

const taById = new Map([
  ["A", { id: "A", name: "Ahmed", color: "#f00" }],
  ["B", { id: "B", name: "Bassem", color: "#0f0" }],
]);

test("clicking a pill while in swap mode selects the target", () => {
  const onSelect = vi.fn();
  const tasks = [{ id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "x" }, taCount: 1, occurrences: [
    { id: "1", date: "2026-10-05", seats: [{ taId: "A", turn: 1 }] }, { id: "2", date: "2026-10-06", seats: [{ taId: "A", turn: 1 }] }] }];
  render(<MonthGrid yearMonth="2026-10" tasks={tasks as any} taById={taById}
    selected={null} swapSource={{ taskId: "t", occurrenceId: "1", taId: "A" }} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: "Quiz · Oct 6 · Ahmed · Light" }));
  expect(onSelect).toHaveBeenCalledWith({ taskId: "t", occurrenceId: "2" });
});

test("MonthGrid dims other-kind pills in swap mode", () => {
  const tasks = [
    { id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "x" }, taCount: 1, occurrences: [
      { id: "1", date: "2026-10-05", seats: [{ taId: "A", turn: 1 }] }, { id: "2", date: "2026-10-06", seats: [{ taId: "B", turn: 1 }] }] },
    { id: "h", title: "Exam", kind: "heavy", createdAt: "", schedule: { type: "one-time", date: "x" }, taCount: 1, occurrences: [
      { id: "3", date: "2026-10-07", seats: [{ taId: "B", turn: 1 }] }] },
  ];
  render(<MonthGrid yearMonth="2026-10" tasks={tasks as any} taById={taById}
    selected={null} swapSource={{ taskId: "t", occurrenceId: "1", taId: "A" }} onSelect={() => {}} />);
  const sameKind = screen.getByRole("button", { name: /^Quiz · Oct 6/ });
  const otherKind = screen.getByRole("button", { name: /^Exam · Oct 7 · Bassem · Heavy/ });
  expect(sameKind.className.split(/\s+/)).not.toContain("opacity-40");
  expect(otherKind.className.split(/\s+/)).toContain("opacity-40");
});

test("an expanded day collapses again after changing month and coming back", () => {
  const tasks = [{ id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "x" }, taCount: 1,
    occurrences: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), date: "2026-10-05", seats: [{ taId: "A", turn: 1 }] })) }];
  const ui = (yearMonth: string) => (
    <MonthGrid yearMonth={yearMonth} tasks={tasks as any} taById={taById} selected={null} swapSource={null} onSelect={() => {}} />
  );
  const { rerender } = render(ui("2026-10"));
  fireEvent.click(screen.getAllByRole("button", { name: /^Show \d+ more on Oct 5/ })[0]);
  expect(screen.getByRole("button", { name: "Less" })).toBeInTheDocument();
  rerender(ui("2026-11"));
  rerender(ui("2026-10"));
  expect(screen.queryByRole("button", { name: "Less" })).not.toBeInTheDocument();
});

test("MonthGrid dims nothing when the source TA is no longer on the source occurrence", () => {
  const tasks = [{ id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "x" }, taCount: 1, occurrences: [
    { id: "1", date: "2026-10-05", seats: [{ taId: "B", turn: 1 }] }, { id: "2", date: "2026-10-06", seats: [{ taId: "A", turn: 1 }] }] }];
  render(<MonthGrid yearMonth="2026-10" tasks={tasks as any} taById={taById}
    selected={null} swapSource={{ taskId: "t", occurrenceId: "1", taId: "A" }} onSelect={() => {}} />);
  // Stale source: Ahmed left Oct 5, so no pill is treated as the source and none is a target.
  expect(screen.queryByRole("button", { name: /· swapping$/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Quiz · Oct 6 · Ahmed · Light" }).className.split(/\s+/)).not.toContain("opacity-40");
});
