export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    HISTORY_DELETE_PASSWORD: process.env.HISTORY_DELETE_PASSWORD || undefined,
    DATA_STORE,
  };
}
