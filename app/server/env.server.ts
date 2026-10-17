/** Same value as DEFAULT_APP_URL in ~/lib/seo; duplicated so server env code imports nothing from the client lib. */
const DEFAULT_APP_URL = "http://localhost:5173";

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  HISTORY_DELETE_PASSWORD?: string;
  DATA_STORE: "supabase" | "memory";
  /** Public origin used for canonical/Open Graph URLs. Not a secret. */
  APP_URL: string;
}

export const MISSING_SUPABASE_MESSAGE = "DATA_STORE=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY.";

/** Production builds and Vercel deploys must never fall back to the in-memory store silently. */
function isDeployed(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

export function getEnv(): Env {
  const SUPABASE_URL = process.env.SUPABASE_URL || undefined;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || undefined;
  const explicit = process.env.DATA_STORE;
  // Dev/test default to memory without Supabase; deployed, only an explicit DATA_STORE=memory does.
  const DATA_STORE: Env["DATA_STORE"] =
    explicit === "memory" || explicit === "supabase"
      ? explicit
      : SUPABASE_URL || isDeployed()
        ? "supabase"
        : "memory";
  if (DATA_STORE === "supabase" && isDeployed() && (!SUPABASE_URL || !SUPABASE_SECRET_KEY)) {
    throw new Error(MISSING_SUPABASE_MESSAGE);
  }
  return {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    HISTORY_DELETE_PASSWORD: process.env.HISTORY_DELETE_PASSWORD || undefined,
    DATA_STORE,
    APP_URL: appUrl(),
  };
}

/** Explicit APP_URL, else the Vercel production host (documented without a scheme, tolerated with one), else localhost. */
function appUrl(): string {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^https?:\/\//i, "");
  return (process.env.APP_URL || (vercelHost ? `https://${vercelHost}` : DEFAULT_APP_URL)).replace(/\/+$/, "");
}
