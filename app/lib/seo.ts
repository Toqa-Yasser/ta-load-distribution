import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "TA Load Distribution";
export const SITE_DESCRIPTION = "Fair, capacity-weighted task sharing for teaching assistants.";
export const DEFAULT_APP_URL = "http://localhost:5173";

export type PageMetaInput = { title?: string; description: string; path: string; appUrl: string };

/** "Team · TA Load Distribution"; the bare site name when there is no page title (dashboard, root). */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

export function absoluteUrl(appUrl: string, path: string): string {
  return appUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

/** Title, description, Open Graph, Twitter card and canonical link for one page. Pure. */
export function pageMeta({ title, description, path, appUrl }: PageMetaInput): MetaDescriptor[] {
  const fullTitle = pageTitle(title);
  const url = absoluteUrl(appUrl, path);
  return [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: absoluteUrl(appUrl, "/og.png") },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { tagName: "link", rel: "canonical", href: url },
  ];
}

/** Identity of a descriptor for de-duplication; undefined means "never collides". */
function metaKey(d: MetaDescriptor): string | undefined {
  const r = d as Record<string, unknown>;
  if ("title" in r) return "title";
  const media = typeof r.media === "string" ? `@${r.media}` : "";
  if (typeof r.name === "string") return `name:${r.name}${media}`;
  if (typeof r.property === "string") return `property:${r.property}`;
  if (r.tagName === "link" && typeof r.rel === "string") return `link:${r.rel}`;
  return undefined;
}

/**
 * React Router renders only the deepest route's meta, so pages re-emit the root's site-wide tags.
 * Parent descriptors the page also defines are dropped; the page's come last.
 */
export function mergeMeta(parent: readonly MetaDescriptor[], own: readonly MetaDescriptor[]): MetaDescriptor[] {
  const ownKeys = new Set(own.map(metaKey).filter((k): k is string => k !== undefined));
  return [...parent.filter((d) => { const k = metaKey(d); return k === undefined || !ownKeys.has(k); }), ...own];
}

type MatchLike = { id: string; meta?: readonly MetaDescriptor[]; loaderData?: unknown };

export function appUrlFromMatches(matches: readonly (MatchLike | undefined)[]): string {
  const data = matches.find((m) => m?.id === "root")?.loaderData as { appUrl?: unknown } | undefined;
  return typeof data?.appUrl === "string" && data.appUrl ? data.appUrl : DEFAULT_APP_URL;
}

/** A route's full meta: the root's site-wide tags plus this page's, with `APP_URL` from the root loader. */
export function routeMeta(matches: readonly (MatchLike | undefined)[], page: Omit<PageMetaInput, "appUrl">): MetaDescriptor[] {
  const root = matches.find((m) => m?.id === "root");
  return mergeMeta(root?.meta ?? [], pageMeta({ ...page, appUrl: appUrlFromMatches(matches) }));
}
