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

test("no engine source imports from app/lib or app/components", () => {
  const files = engineSources(join(__dirname, ".."));
  expect(files.length).toBeGreaterThan(5);
  for (const f of files) {
    expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["'](~\/|(\.\.\/)+)(lib|components)(\/|["'])/);
  }
});

test("the boundary scan finds nested files and catches relative imports", () => {
  expect(engineSources(join(__dirname, "..")).some((f) => f.endsWith("migrate.ts"))).toBe(true);
  const re = /from\s+["'](~\/|(\.\.\/)+)(lib|components)(\/|["'])/;
  for (const bad of ['from "~/lib/x"', "from '../lib/x'", 'from "../../components/y"', 'from "~/components/z"']) expect(bad).toMatch(re);
  expect('from "./types"').not.toMatch(re);
});

test("palette lives in the engine and ta-colors re-exports it", () => {
  expect(legacy.TA_COLORS).toBe(TA_COLORS);
  expect(legacy.nextTaColor).toBe(nextTaColor);
});
