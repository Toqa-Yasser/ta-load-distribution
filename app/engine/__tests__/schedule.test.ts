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
test("customDates clamps count to 1..500 and gap to at least 1", () => {
  expect(customDates("2026-10-01", 0, 3)).toEqual(["2026-10-01"]);
  expect(customDates("2026-10-01", -4, 3)).toEqual(["2026-10-01"]);
  expect(customDates("2026-10-01", 9999, 1)).toHaveLength(500);
  expect(customDates("2026-10-01", 3, 0)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  expect(customDates("2026-10-01", 2, -5)).toEqual(["2026-10-01", "2026-10-02"]);
});
test("exactly 500 occurrences pass and 501 throw (daily)", () => {
  const wide = { name: "W", start: "2026-01-01", end: "2030-12-31" };
  const d500 = generateDates({ type: "daily", start: "2026-01-01", end: "2027-05-15" }, wide);
  expect(d500).toHaveLength(500);
  expect(() => generateDates({ type: "daily", start: "2026-01-01", end: "2027-05-16" }, wide)).toThrow(TooManyOccurrencesError);
});
test("exactly 500 occurrences pass and 501 throw (custom)", () => {
  const dates = (n: number) => customDatesUnclamped("2026-01-01", n);
  expect(generateDates({ type: "custom", start: "2026-01-01", count: 500, gapDays: 1, dates: dates(500) }, sem)).toHaveLength(500);
  expect(() => generateDates({ type: "custom", start: "2026-01-01", count: 501, gapDays: 1, dates: dates(501) }, sem)).toThrow(TooManyOccurrencesError);
});
describe.each(["America/New_York", "Africa/Cairo", "Europe/London", "Pacific/Auckland"])("dates are stable across DST in %s", (tz) => {
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = tz; });
  afterAll(() => { process.env.TZ = original; });
  test("weekly and daily cross the autumn/spring transitions without drift", () => {
    expect(generateDates({ type: "weekly", start: "2026-10-22", end: "2026-11-12" }, sem))
      .toEqual(["2026-10-22", "2026-10-29", "2026-11-05", "2026-11-12"]);
    expect(generateDates({ type: "daily", start: "2026-10-24", end: "2026-10-27" }, sem))
      .toEqual(["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    expect(generateDates({ type: "daily", start: "2027-03-27", end: "2027-03-29" }, { ...sem, end: "2027-06-30" }))
      .toEqual(["2027-03-27", "2027-03-28", "2027-03-29"]);
    expect(customDates("2026-10-31", 3, 1)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

function customDatesUnclamped(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(new Date(d.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}
