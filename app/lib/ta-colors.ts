import type { TA } from "~/engine/types";

/** Coral, amber, mint, teal, sky, violet, magenta, lime, rose, indigo. */
export const TA_COLORS: string[] = [
  "#f26b5b",
  "#f2a93b",
  "#4cc9a0",
  "#20a4a8",
  "#4aa8e8",
  "#9b7bea",
  "#d85ac0",
  "#9ccc3f",
  "#ee6c8f",
  "#5c6bd6",
];

/** The least-used colour among existing TAs; the first one wins ties. */
export function nextTaColor(existing: TA[]): string {
  const counts = TA_COLORS.map((c) => existing.filter((t) => t.color === c).length);
  return TA_COLORS[counts.indexOf(Math.min(...counts))];
}
