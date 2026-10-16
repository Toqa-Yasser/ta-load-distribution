export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  HISTORY_DELETE_PASSWORD?: string;
  DATA_STORE: "supabase" | "memory";
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
  };
}
