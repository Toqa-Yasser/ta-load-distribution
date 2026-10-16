import { todayIn } from "~/server/today.server";

test("today is computed in the given timezone, not UTC", () => {
  // 22:30 UTC on Oct 16 is already Oct 17 in Cairo (UTC+3 in October 2026).
  const at = new Date("2026-10-16T22:30:00.000Z");
  expect(todayIn("Africa/Cairo", at)).toBe("2026-10-17");
  expect(todayIn("UTC", at)).toBe("2026-10-16");
  expect(todayIn("America/Los_Angeles", at)).toBe("2026-10-16");
});
test("defaults to APP_TIMEZONE, then Africa/Cairo", () => {
  const prev = process.env.APP_TIMEZONE;
  const at = new Date("2026-10-16T22:30:00.000Z");
  try {
    delete process.env.APP_TIMEZONE;
    expect(todayIn(undefined, at)).toBe("2026-10-17");
    process.env.APP_TIMEZONE = "UTC";
    expect(todayIn(undefined, at)).toBe("2026-10-16");
  } finally {
    if (prev === undefined) delete process.env.APP_TIMEZONE;
    else process.env.APP_TIMEZONE = prev;
  }
});
