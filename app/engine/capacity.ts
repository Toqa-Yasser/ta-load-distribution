import type { Workspace } from "~/engine/types";

/** Each section contributes +1 per slot it has filled with a TA. */
export function capacities(ws: Workspace): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ta of ws.tas) result[ta.id] = 0;
  for (const section of ws.sections) {
    for (const taId of section.taIds) {
      if (taId !== null && taId in result) result[taId] += 1;
    }
  }
  return result;
}

export function turnSize(ws: Workspace): number {
  return Object.values(capacities(ws)).reduce((sum, c) => sum + c, 0);
}

export function remainingFraction(capacity: number, used: number): number {
  if (capacity === 0) return -Infinity;
  return (capacity - used) / capacity;
}

/** TAs that hold at least one section slot; the most co-staffing a date can ask for. */
export function eligibleCount(ws: Workspace): number {
  return Object.values(capacities(ws)).filter((c) => c > 0).length;
}
