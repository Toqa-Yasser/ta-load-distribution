import { fmtScheduleSummary, fmtDate } from "~/lib/format";
test("fmtDate", () => { expect(fmtDate("2026-10-20")).toBe("Oct 20"); });
test("schedule summaries", () => {
  expect(fmtScheduleSummary({ type: "one-time", date: "2026-10-20" })).toBe("One-time · Oct 20");
  expect(fmtScheduleSummary({ type: "weekly", start: "2026-10-01", end: null })).toBe("Weekly · Oct 1 → end of semester");
  expect(fmtScheduleSummary({ type: "custom", start: "2026-10-01", count: 4, gapDays: 3, dates: ["a","b","c","d"] })).toBe("Custom · 4 dates");
});
