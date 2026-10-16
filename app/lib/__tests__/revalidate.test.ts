import { shouldRevalidateRoot } from "~/lib/revalidate";

const url = (s: string) => new URL(s, "http://x");
const args = (over: Partial<Parameters<typeof shouldRevalidateRoot>[0]>) => ({
  currentUrl: url("/tasks"),
  nextUrl: url("/tasks"),
  defaultShouldRevalidate: true,
  ...over,
});

test("skips the root loader after a preview", () => {
  expect(shouldRevalidateRoot(args({ formMethod: "POST", formAction: "/api/preview" }))).toBe(false);
});
test("revalidates after commands and history actions", () => {
  expect(shouldRevalidateRoot(args({ formMethod: "POST", formAction: "/api/command" }))).toBe(true);
  expect(shouldRevalidateRoot(args({ formMethod: "POST", formAction: "/api/history" }))).toBe(true);
});
test("skips a search-only change such as ?new=1", () => {
  expect(shouldRevalidateRoot(args({ nextUrl: url("/tasks?new=1") }))).toBe(false);
});
test("otherwise defers to the default", () => {
  expect(shouldRevalidateRoot(args({ nextUrl: url("/calendar"), defaultShouldRevalidate: false }))).toBe(false);
  expect(shouldRevalidateRoot(args({}))).toBe(true);
});
