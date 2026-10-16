// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { DayCell } from "~/components/calendar/DayCell";

test("overflow toggle has a 44px hit area", () => {
  const task = { id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [] };
  const entries = [1, 2, 3, 4, 5].map((n) => ({ task, occ: { id: String(n), date: "2026-10-05", taId: "A", turn: 1 } }));
  render(<DayCell date="2026-10-05" inMonth isToday={false} entries={entries as any} taById={new Map()}
    selected={null} swapSource={null} swapTaId={null} swapKind={null} onSelect={() => {}} />);
  for (const btn of screen.getAllByRole("button", { name: /^Show \d+ more/ })) {
    expect(btn.className.split(/\s+/)).toContain("min-h-11");
  }
});
