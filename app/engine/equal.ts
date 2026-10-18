import type { PendingOccurrence } from "~/engine/distribute";
import { NotEnoughTAsError, ValidationError, type Occurrence } from "~/engine/types";

/**
 * Equal dealing: seats `taCount` distinct TAs on every occurrence, in date order, always taking
 * the TA with the fewest seats so far (ties go to the earliest in `order`). `held` are the task's
 * untouched occurrences, counted but not returned. Both checks run first so a failed deal changes nothing.
 */
export function dealEqual(args: {
  order: string[];
  occurrences: PendingOccurrence[];
  taCount: number;
  held?: Occurrence[];
  taskTitle?: string;
}): Occurrence[] {
  const { order, taCount, taskTitle } = args;
  if (order.length === 0) {
    throw new ValidationError(taskTitle === undefined ? "Add TAs on the Team page first." : `"${taskTitle}" has no TA left to cover its dates.`);
  }
  if (order.length < taCount) throw new NotEnoughTAsError(taCount, order.length, taskTitle, "order");

  const count: Record<string, number> = {};
  const add = (taId: string) => (count[taId] = (count[taId] ?? 0) + 1);
  for (const occ of args.held ?? []) occ.seats.forEach((s) => add(s.taId));
  for (const occ of args.occurrences) (occ.seats ?? []).forEach((s) => add(s.taId));

  const sorted = [...args.occurrences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted.map((occ) => {
    const seats = [...(occ.seats ?? [])];
    while (seats.length < taCount) {
      let best: string | undefined;
      for (const id of order) {
        if (seats.some((s) => s.taId === id)) continue;
        if (best === undefined || (count[id] ?? 0) < (count[best] ?? 0)) best = id;
      }
      const taId = best as string;
      add(taId);
      seats.push({ taId, turn: count[taId] });
    }
    return { id: occ.id, date: occ.date, seats };
  });
}
