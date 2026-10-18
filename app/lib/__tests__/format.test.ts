import { fmtScheduleSummary, fmtDate, fmtTaskSummary, withArticle } from "~/lib/format";
test("fmtDate", () => { expect(fmtDate("2026-10-20")).toBe("Oct 20"); });
test("schedule summaries", () => {
  expect(fmtScheduleSummary({ type: "one-time", date: "2026-10-20" })).toBe("One-time · Oct 20");
  expect(fmtScheduleSummary({ type: "weekly", start: "2026-10-01", end: null })).toBe("Weekly · Oct 1 → end of semester");
  expect(fmtScheduleSummary({ type: "custom", start: "2026-10-01", count: 4, gapDays: 3, dates: ["a","b","c","d"] })).toBe("Custom · 4 dates");
});

test("fmtTaskSummary appends the TA count only above 1", () => {
  const schedule = { type: "weekly", start: "2026-10-01", end: null } as const;
  expect(fmtTaskSummary({ schedule, taCount: 1 })).toBe("Weekly · Oct 1 → end of semester");
  expect(fmtTaskSummary({ schedule, taCount: 2 })).toBe("Weekly · Oct 1 → end of semester · 2 TAs per date");
});

test("withArticle picks the article for each kind", () => {
  expect(withArticle("light")).toBe("a light");
  expect(withArticle("heavy")).toBe("a heavy");
  expect(withArticle("equal")).toBe("an equal");
});
