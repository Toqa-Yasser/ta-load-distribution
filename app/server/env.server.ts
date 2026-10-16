export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  HISTORY_DELETE_PASSWORD?: string;
  DATA_STORE: "supabase" | "memory";
}

export function getEnv(): Env {
  const SUPABASE_URL = process.env.SUPABASE_URL || undefined;
  const explicit = process.env.DATA_STORE;
  const DATA_STORE: Env["DATA_STORE"] =
    explicit === "memory" || explicit === "supabase" ? explicit : SUPABASE_URL ? "supabase" : "memory";
  return {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    HISTORY_DELETE_PASSWORD: process.env.HISTORY_DELETE_PASSWORD || undefined,
    DATA_STORE,
  };
}
