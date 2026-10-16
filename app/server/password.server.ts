import { timingSafeEqual } from "node:crypto";

export function checkHistoryPassword(given: string, configured: string | undefined): boolean {
  if (!configured) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
