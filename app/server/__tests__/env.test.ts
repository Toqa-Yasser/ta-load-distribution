import { getEnv } from "~/server/env.server";

const KEYS = ["NODE_ENV", "VERCEL", "DATA_STORE", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const MISSING = "DATA_STORE=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY.";

test("dev/test without Supabase falls back to the memory store", () => {
  process.env.NODE_ENV = "test";
  expect(getEnv().DATA_STORE).toBe("memory");
});
test("production without Supabase env refuses to start", () => {
  process.env.NODE_ENV = "production";
  expect(() => getEnv()).toThrow(MISSING);
});
test("on Vercel without Supabase env refuses to start", () => {
  process.env.NODE_ENV = "development";
  process.env.VERCEL = "1";
  expect(() => getEnv()).toThrow(MISSING);
});
test("production with only the URL still refuses (missing secret key)", () => {
  process.env.NODE_ENV = "production";
  process.env.SUPABASE_URL = "https://x.supabase.co";
  expect(() => getEnv()).toThrow(MISSING);
});
test("production uses Supabase when both vars are set", () => {
  process.env.NODE_ENV = "production";
  process.env.SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
  expect(getEnv().DATA_STORE).toBe("supabase");
});
test("production with an explicit DATA_STORE=memory keeps the memory store", () => {
  process.env.NODE_ENV = "production";
  process.env.DATA_STORE = "memory";
  expect(getEnv().DATA_STORE).toBe("memory");
});

test("APP_URL defaults to the local dev origin and drops a trailing slash", () => {
  process.env.NODE_ENV = "test";
  expect(getEnv().APP_URL).toBe("http://localhost:5173");
  process.env.APP_URL = "https://load.example.edu/";
  expect(getEnv().APP_URL).toBe("https://load.example.edu");
});

test("APP_URL falls back to the Vercel production URL, then localhost; explicit APP_URL wins", () => {
  process.env.NODE_ENV = "test";
  expect(getEnv().APP_URL).toBe("http://localhost:5173");
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "app.vercel.app";
  expect(getEnv().APP_URL).toBe("https://app.vercel.app");
  process.env.APP_URL = "https://custom.example/";
  expect(getEnv().APP_URL).toBe("https://custom.example");
});

test("the Vercel production URL fallback strips an accidental scheme", () => {
  process.env.NODE_ENV = "test";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "https://app.vercel.app/";
  expect(getEnv().APP_URL).toBe("https://app.vercel.app");
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "http://app.vercel.app";
  expect(getEnv().APP_URL).toBe("https://app.vercel.app");
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "HTTPS://app.vercel.app";
  expect(getEnv().APP_URL).toBe("https://app.vercel.app");
});
