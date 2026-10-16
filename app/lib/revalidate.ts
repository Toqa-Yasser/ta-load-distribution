import type { ShouldRevalidateFunctionArgs } from "react-router";

type Args = Pick<ShouldRevalidateFunctionArgs, "currentUrl" | "nextUrl" | "formMethod" | "formAction" | "defaultShouldRevalidate">;

/**
 * Root-loader revalidation. A preview runs the reducer without saving, and the loader ignores
 * the URL, so neither a preview nor a search-only change (`?new=1`, `?m=`) can change its data.
 * Commands, history actions and explicit revalidate() calls keep the default.
 */
export function shouldRevalidateRoot({ currentUrl, nextUrl, formMethod, formAction, defaultShouldRevalidate }: Args): boolean {
  if (formAction?.split("?")[0] === "/api/preview") return false;
  if (!formMethod && currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) return false;
  return defaultShouldRevalidate;
}
