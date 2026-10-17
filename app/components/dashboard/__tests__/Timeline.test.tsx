// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { Timeline } from "~/components/dashboard/Timeline";
import type { Task } from "~/engine/types";

const ahmed = { id: "A", name: "Ahmed", color: "#f00" };
const taById = new Map([["A", ahmed]]);
const task = (dates: string[], kind: Task["kind"] = "light", title = "Quiz"): Task => ({
  id: title, title, kind, createdAt: "", schedule: { type: "one-time", date: dates[0] },
  occurrences: dates.map((date, i) => ({ id: String(i), date, taId: "A", turn: 1 })),
});

test("Timeline shows only the next 14 days", () => {
  render(<Timeline tasks={[task(["2026-10-17", "2026-11-30"])]} taById={taById} today="2026-10-16" />);
  expect(screen.getByText("Oct 17")).toBeInTheDocument();
  expect(screen.queryByText("Nov 30")).not.toBeInTheDocument();
});

test("Timeline includes today and excludes today + 14", () => {
  render(<Timeline tasks={[task(["2026-10-15", "2026-10-16", "2026-10-29", "2026-10-30"])]} taById={taById} today="2026-10-16" />);
  expect(screen.queryByText("Oct 15")).not.toBeInTheDocument();
  expect(screen.getByText("Oct 16")).toBeInTheDocument();
  expect(screen.getByText("Oct 29")).toBeInTheDocument();
  expect(screen.queryByText("Oct 30")).not.toBeInTheDocument();
});

test("Timeline badges today and tomorrow only", () => {
  render(<Timeline tasks={[task(["2026-10-16", "2026-10-17", "2026-10-18"])]} taById={taById} today="2026-10-16" />);
  const row = (label: string) => screen.getByText(label).closest("li")!;
  expect(within(row("Oct 16")).getByText("Today")).toBeInTheDocument();
  expect(within(row("Oct 17")).getByText("Tomorrow")).toBeInTheDocument();
  expect(within(row("Oct 18")).queryByText(/Today|Tomorrow/)).not.toBeInTheDocument();
});

test("the TA chip sits right after the kind badge, not at the far end of the row", () => {
  render(<Timeline tasks={[task(["2026-10-16"], "heavy", "Exam")]} taById={taById} today="2026-10-16" />);
  const badge = screen.getByText("Heavy", { selector: "[data-badge]" });
  const owner = screen.getByText("Ahmed").closest("[data-badge]");
  expect(owner).not.toBeNull();
  expect(badge.nextElementSibling).toBe(owner);
});

test("Timeline rows carry the task's kind badge", () => {
  render(<Timeline tasks={[task(["2026-10-16"], "heavy", "Exam")]} taById={taById} today="2026-10-16" />);
  expect(screen.getByText("Heavy", { selector: "[data-badge]" })).toBeInTheDocument();
});
