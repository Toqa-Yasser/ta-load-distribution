/** Today's date (YYYY-MM-DD) in the app's timezone: APP_TIMEZONE, else Africa/Cairo. */
export function todayIn(timeZone = process.env.APP_TIMEZONE || "Africa/Cairo", now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
