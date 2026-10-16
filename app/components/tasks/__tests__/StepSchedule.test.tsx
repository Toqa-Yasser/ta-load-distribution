// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { scheduleDates, StepSchedule } from "~/components/tasks/StepSchedule";
import type { Schedule, Semester } from "~/engine/types";

const semester: Semester = { name: "S", start: "2026-09-01", end: "2027-01-31" };

function switchTo(from: Schedule, label: string) {
  const onChange = vi.fn();
  render(<StepSchedule schedule={from} semester={semester} onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: label }));
  return onChange.mock.calls[0]?.[0] as Schedule | undefined;
}

test("switching type carries the start date and a recurring end across", () => {
  const weekly: Schedule = { type: "weekly", start: "2026-10-05", end: "2026-12-01" };
  expect(switchTo(weekly, "Daily")).toEqual({ type: "daily", start: "2026-10-05", end: "2026-12-01" });
});

test("switching to one-time keeps the start as its date; to custom keeps the start", () => {
  const monthly: Schedule = { type: "monthly", start: "2026-10-07", end: null };
  expect(switchTo(monthly, "One-time")).toEqual({ type: "one-time", date: "2026-10-07" });
});

test("switching from one-time to weekly starts on its date and runs to the semester end", () => {
  const once: Schedule = { type: "one-time", date: "2026-11-02" };
  expect(switchTo(once, "Weekly")).toEqual({ type: "weekly", start: "2026-11-02", end: null });
});

test("re-picking the current type sends nothing", () => {
  expect(switchTo({ type: "weekly", start: "2026-10-05", end: null }, "Weekly")).toBeUndefined();
});

test("a schedule over the 500-date cap is refused with the engine's message", () => {
  const long: Semester = { name: "L", start: "2026-01-01", end: "2028-12-31" };
  const r = scheduleDates({ type: "daily", start: "2026-01-01", end: null }, long);
  expect(r.count).toBe(0);
  expect(r.error).toMatch(/500/);
  expect(scheduleDates({ type: "weekly", start: "2026-01-01", end: null }, long).error).toBeNull();
});
