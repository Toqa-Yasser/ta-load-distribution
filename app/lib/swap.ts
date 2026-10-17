import type { Occurrence, Task } from "~/engine/types";

/** The seat a swap starts from: its task, its occurrence and the TA sitting on it. */
export type SeatSource = { task: Task; occ: Occurrence; taId: string };

/**
 * TA ids of the seats on `target` that the source seat may trade with, in seat order (spec §4.3);
 * [] means the target is ineligible. A target must be another occurrence of the same kind that the
 * source TA does not already sit on; a seat is excluded when its TA already sits on the source
 * occurrence, since the trade would seat that TA twice there.
 */
export function swappableSeats(source: SeatSource, target: { task: Task; occ: Occurrence }): string[] {
  if (target.task.id === source.task.id && target.occ.id === source.occ.id) return [];
  if (target.task.kind !== source.task.kind) return [];
  if (target.occ.seats.some((s) => s.taId === source.taId)) return [];
  const onSource = new Set(source.occ.seats.map((s) => s.taId));
  return target.occ.seats.map((s) => s.taId).filter((taId) => taId !== source.taId && !onSource.has(taId));
}
