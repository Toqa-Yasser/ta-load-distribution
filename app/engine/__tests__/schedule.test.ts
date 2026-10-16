import { generateDates, customDates } from "~/engine/schedule";
import { TooManyOccurrencesError } from "~/engine/types";
const sem = { name: "F26", start: "2026-09-01", end: "2026-12-31" };

test("one-time yields the single date", () => {
  expect(generateDates({ type: "one-time", date: "2026-10-05" }, sem)).toEqual(["2026-10-05"]);
});
test("weekly with explicit end is inclusive", () => {
  expect(generateDates({ type: "weekly", start: "2026-10-01", end: "2026-10-22" }, sem))
    .toEqual(["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"]);
});
test("daily with end=null runs to semester end", () => {
  const ds = generateDates({ type: "daily", start: "2026-12-29", end: null }, sem);
  expect(ds).toEqual(["2026-12-29", "2026-12-30", "2026-12-31"]);
});
test("monthly clamps the day of month", () => {
  expect(generateDates({ type: "monthly", start: "2026-08-31", end: "2026-11-30" }, sem))
    .toEqual(["2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30"]);
});
test("start after end yields nothing", () => {
  expect(generateDates({ type: "weekly", start: "2027-01-05", end: null }, sem)).toEqual([]);
});
test("custom dates are sorted and de-duplicated", () => {
  expect(generateDates({ type: "custom", start: "2026-10-01", count: 3, gapDays: 5,
    dates: ["2026-10-11", "2026-10-01", "2026-10-11", "2026-10-06"] }, sem))
    .toEqual(["2026-10-01", "2026-10-06", "2026-10-11"]);
});
test("customDates generates start + i*gap", () => {
  expect(customDates("2026-10-01", 3, 10)).toEqual(["2026-10-01", "2026-10-11", "2026-10-21"]);
});
test("more than 500 occurrences throws", () => {
  expect(() => generateDates({ type: "daily", start: "2020-01-01", end: "2026-12-31" }, sem)).toThrow(TooManyOccurrencesError);
});
