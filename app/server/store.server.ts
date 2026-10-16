import { getEnv, MISSING_SUPABASE_MESSAGE } from "./env.server";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store.server";
import type { Store } from "./store";

declare global {
  // eslint-disable-next-line no-var
  var __memStore: MemoryStore | undefined;
}

let supabaseStore: SupabaseStore | undefined;

// Validate at import so a misconfigured production server fails at boot, not on the first request.
getEnv();

export function getStore(): Store {
  const env = getEnv();
  if (env.DATA_STORE === "memory") {
    // Kept on globalThis so Vite dev HMR does not wipe the data.
    return (globalThis.__memStore ??= new MemoryStore());
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error(MISSING_SUPABASE_MESSAGE);
  }
  return (supabaseStore ??= new SupabaseStore(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY));
}
