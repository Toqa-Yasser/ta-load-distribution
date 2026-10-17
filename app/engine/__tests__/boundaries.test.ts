import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TA_COLORS, nextTaColor } from "~/engine/palette";
import * as legacy from "~/lib/ta-colors";

function engineSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : engineSources(path);
    return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Every import form: `from "x"`, bare `import "x"`, dynamic `import("x")` and `require("x")`. */
const FORBIDDEN = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'](?:~\/|(?:\.\.\/)+)(?:lib|components|server)(?:\/|["'])/;

test("no engine source imports from app/lib, app/components or app/server", () => {
  const files = engineSources(join(__dirname, ".."));
  expect(files.length).toBeGreaterThan(5);
  for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(FORBIDDEN);
});

test("the boundary scan finds nested files and catches every import form", () => {
  const files = engineSources(join(__dirname, ".."));
  expect(files.some((f) => f.endsWith("migrate.ts"))).toBe(true);
  expect(files.some((f) => f.includes("__tests__"))).toBe(false);
  const bad = [
    'from "~/lib/x"', "from '../lib/x'", 'from "../../components/y"', 'from "~/components/z"',
    'from "~/server/store"', "from '../server/env.server'", 'import "~/lib/side-effect"',
    'import("../components/Lazy")', 'import ( "~/server/x" )', 'require("~/lib/x")', 'export * from "~/lib"',
  ];
  for (const b of bad) expect(b).toMatch(FORBIDDEN);
  for (const ok of ['from "./types"', 'from "~/engine/types"', 'import "nanoid"', 'from "date-fns"', 'from "~/library"']) {
    expect(ok).not.toMatch(FORBIDDEN);
  }
});

test("palette lives in the engine and ta-colors re-exports it", () => {
  expect(legacy.TA_COLORS).toBe(TA_COLORS);
  expect(legacy.nextTaColor).toBe(nextTaColor);
});
