import { MotionConfig } from "motion/react";
import { data, isRouteErrorResponse, Links, Meta, Scripts, ScrollRestoration, type ShouldRevalidateFunction } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { AppShell } from "~/components/layout/AppShell";
import { ValidationError } from "~/engine/types";
import { TopProgress } from "~/components/layout/TopProgress";
import { Toaster } from "~/components/ui/Toast";
import { UNREADABLE_WORKSPACE_MESSAGE } from "~/lib/errors";
import { shouldRevalidateRoot } from "~/lib/revalidate";
import { absoluteUrl, DEFAULT_APP_URL, SITE_DESCRIPTION, SITE_NAME } from "~/lib/seo";
import { VIEWPORT_CONTENT } from "~/lib/viewport";
import { THEME_INIT_SCRIPT, ThemeProvider } from "~/lib/theme";
import { ToastProvider } from "~/lib/toast";
import type { RootLoaderData } from "~/lib/use-workspace";
import { getEnv } from "~/server/env.server";
import { getStore } from "~/server/store.server";
import { todayIn } from "~/server/today.server";
import { loadWorkspace } from "~/server/workspace.server";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Sora:wght@500..800&display=swap",
  },
  { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
];

// Site-wide tags. Pages re-emit these via routeMeta(), since only the deepest route's meta renders.
export function meta({ loaderData }: Route.MetaArgs) {
  const appUrl = loaderData?.appUrl ?? DEFAULT_APP_URL;
  return [
    { title: SITE_NAME },
    { name: "description", content: SITE_DESCRIPTION },
    { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f6f3ee" },
    { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0e0f14" },
    { name: "robots", content: "index,follow" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:image", content: absoluteUrl(appUrl, "/og.png") },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export async function loader(): Promise<RootLoaderData> {
  try {
    const { data: workspace, version } = await loadWorkspace(getStore());
    return { workspace, version, today: todayIn(), appUrl: getEnv().APP_URL };
  } catch (e) {
    // A stored document that fails validation. Thrown errors are masked in production, so say
    // what happened (and what to do) through a route error response instead.
    if (e instanceof ValidationError) {
      console.error(e);
      throw data(UNREADABLE_WORKSPACE_MESSAGE, { status: 500 });
    }
    throw e;
  }
}

export const shouldRevalidate: ShouldRevalidateFunction = shouldRevalidateRoot;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by the init script before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta charSet="utf-8" />
        <meta name="viewport" content={VIEWPORT_CONTENT} />
        <meta name="color-scheme" content="light dark" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    // reducedMotion="user" disables transform/layout animations (hover lift, tap scale,
    // layoutId indicators, page slides) for prefers-reduced-motion users across the app.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <AppShell />
          {/* Outside #app-root: a sheet makes that inert, and the bar and aria-busy must stay live. */}
          <TopProgress />
          <Toaster />
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    // Route error responses are thrown on purpose (e.g. the unreadable-workspace 500), so their
    // text is meant for the user; other errors stay generic outside dev.
    const text = typeof error.data === "string" && error.data ? error.data : error.statusText;
    details = error.status === 404 ? "The requested page could not be found." : text || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-6 pt-16">
      <div className="glass p-6">
        <h1 className="text-display font-semibold">{message}</h1>
        <p className="mt-2 break-words text-muted">{details}</p>
        {stack && (
          <pre className="mt-4 w-full overflow-x-auto text-xs">
            <code>{stack}</code>
          </pre>
        )}
        <a href="/" className="mt-4 inline-flex min-h-11 items-center font-medium text-accent-ink">
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
