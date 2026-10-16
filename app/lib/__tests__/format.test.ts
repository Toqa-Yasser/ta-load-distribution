import { fmtScheduleSummary, fmtDate } from "~/lib/format";
const sem = { name: "F26", start: "2026-09-01", end: "2026-12-31" };
test("fmtDate", () => { expect(fmtDate("2026-10-20")).toBe("Oct 20"); });
test("schedule summaries", () => {
  expect(fmtScheduleSummary({ type: "one-time", date: "2026-10-20" }, sem)).toBe("One-time · Oct 20");
  expect(fmtScheduleSummary({ type: "weekly", start: "2026-10-01", end: null }, sem)).toBe("Weekly · Oct 1 → end of semester");
  expect(fmtScheduleSummary({ type: "custom", start: "2026-10-01", count: 4, gapDays: 3, dates: ["a","b","c","d"] }, sem)).toBe("Custom · 4 dates");
});
