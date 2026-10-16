import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TA_COLORS, nextTaColor } from "~/engine/palette";
import * as legacy from "~/lib/ta-colors";

test("the engine never imports from app/lib", () => {
  const dir = join(__dirname, "..");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  for (const f of files) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/from\s+["']~\/lib\//);
});

test("palette lives in the engine and ta-colors re-exports it", () => {
  expect(legacy.TA_COLORS).toBe(TA_COLORS);
  expect(legacy.nextTaColor).toBe(nextTaColor);
});
