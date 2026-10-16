import { mergeMeta, pageMeta, pageTitle, routeMeta, SITE_NAME } from "~/lib/seo";

const APP = "https://load.example.edu";

test("pageTitle suffixes the site name, and the bare site name without a title", () => {
  expect(pageTitle("Team")).toBe("Team · TA Load Distribution");
  expect(pageTitle()).toBe(SITE_NAME);
});

test("pageMeta returns title, description, Open Graph, Twitter and canonical descriptors", () => {
  expect(pageMeta({ title: "Team", description: "TAs.", path: "/team", appUrl: APP })).toEqual([
    { title: "Team · TA Load Distribution" },
    { name: "description", content: "TAs." },
    { property: "og:title", content: "Team · TA Load Distribution" },
    { property: "og:description", content: "TAs." },
    { property: "og:url", content: "https://load.example.edu/team" },
    { property: "og:image", content: "https://load.example.edu/og.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Team · TA Load Distribution" },
    { name: "twitter:description", content: "TAs." },
    { tagName: "link", rel: "canonical", href: "https://load.example.edu/team" },
  ]);
});

test("pageMeta tolerates a trailing slash on appUrl and uses the site name for the dashboard", () => {
  const meta = pageMeta({ description: "D.", path: "/", appUrl: `${APP}/` });
  expect(meta).toContainEqual({ title: "TA Load Distribution" });
  expect(meta).toContainEqual({ property: "og:url", content: "https://load.example.edu/" });
  expect(meta).toContainEqual({ tagName: "link", rel: "canonical", href: "https://load.example.edu/" });
});

test("mergeMeta keeps parent site-wide tags and lets the page override duplicates", () => {
  const parent = [
    { title: "TA Load Distribution" },
    { name: "description", content: "site" },
    { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f6f3ee" },
    { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0e0f14" },
    { property: "og:site_name", content: "TA Load Distribution" },
  ];
  const merged = mergeMeta(parent, [{ title: "Team · TA Load Distribution" }, { name: "description", content: "page" }]);
  expect(merged).toEqual([
    parent[2],
    parent[3],
    parent[4],
    { title: "Team · TA Load Distribution" },
    { name: "description", content: "page" },
  ]);
});

test("routeMeta reads appUrl from the root match and merges the root meta", () => {
  const matches = [{ id: "root", meta: [{ property: "og:type", content: "website" }], loaderData: { appUrl: APP } }];
  const meta = routeMeta(matches, { title: "Calendar", description: "Month.", path: "/calendar" });
  expect(meta[0]).toEqual({ property: "og:type", content: "website" });
  expect(meta).toContainEqual({ tagName: "link", rel: "canonical", href: `${APP}/calendar` });
});

test("routeMeta falls back to the default app URL without root data", () => {
  const meta = routeMeta([], { title: "Calendar", description: "Month.", path: "/calendar" });
  expect(meta).toContainEqual({ property: "og:url", content: "http://localhost:5173/calendar" });
});
