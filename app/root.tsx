import { format } from "date-fns";
import { MotionConfig } from "motion/react";
import { isRouteErrorResponse, Links, Meta, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { AppShell } from "~/components/layout/AppShell";
import { ToastProvider } from "~/components/ui/Toast";
import { THEME_INIT_SCRIPT } from "~/lib/theme";
import type { RootLoaderData } from "~/lib/use-workspace";
import { getStore } from "~/server/store.server";
import { loadWorkspace } from "~/server/workspace.server";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Sora:wght@500..800&display=swap",
  },
];

export function meta({}: Route.MetaArgs) {
  return [{ title: "TA Load Distribution" }];
}

export async function loader(): Promise<RootLoaderData> {
  const { data, version } = await loadWorkspace(getStore());
  return { workspace: data, version, today: format(new Date(), "yyyy-MM-dd") };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by the init script before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </MotionConfig>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-2xl p-6 pt-16">
      <div className="glass p-6">
        <h1 className="text-3xl font-semibold">{message}</h1>
        <p className="mt-2 text-muted">{details}</p>
        {stack && (
          <pre className="mt-4 w-full overflow-x-auto text-xs">
            <code>{stack}</code>
          </pre>
        )}
        <a href="/" className="mt-4 inline-flex min-h-11 items-center font-medium text-accent">
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
