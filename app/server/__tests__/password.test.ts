import { checkHistoryPassword } from "~/server/password.server";
test("deleteHistory refuses when the configured password is empty", () => {
  expect(checkHistoryPassword("", "")).toBe(false);
  expect(checkHistoryPassword("", undefined)).toBe(false);
});
test("matches only the exact password", () => {
  expect(checkHistoryPassword("abc", "abc")).toBe(true);
  expect(checkHistoryPassword("abcd", "abc")).toBe(false);
});
