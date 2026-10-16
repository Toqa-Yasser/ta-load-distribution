import { remainingFraction } from "~/engine/capacity";
import { pick, type Rng } from "~/engine/rng";
import { NoCapacityError, type ISODate, type Ledger, type Occurrence } from "~/engine/types";

export interface PendingOccurrence { id: string; date: ISODate }

const EPSILON = 1e-9;

export function assignOccurrences(args: {
  capacities: Record<string, number>;
  ledger: Ledger;
  occurrences: PendingOccurrence[];
  rng: Rng;
}): { ledger: Ledger; occurrences: Occurrence[] } {
  const { capacities, rng } = args;
  const eligible = Object.keys(capacities).filter((id) => capacities[id] > 0);
  if (eligible.length === 0) throw new NoCapacityError();

  let turn = args.ledger.turn;
  let used: Record<string, number> = { ...args.ledger.used };
  const sorted = [...args.occurrences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: Occurrence[] = [];

  for (const occ of sorted) {
    if (eligible.every((id) => (used[id] ?? 0) >= capacities[id])) {
      turn += 1;
      used = {};
    }
    const fractions = eligible.map((id) => remainingFraction(capacities[id], used[id] ?? 0));
    const best = Math.max(...fractions);
    const tied = eligible.filter((_, i) => Math.abs(fractions[i] - best) <= EPSILON);
    const taId = pick(tied, rng);
    used[taId] = (used[taId] ?? 0) + 1;
    out.push({ ...occ, taId, turn });
  }

  return { ledger: { turn, used }, occurrences: out };
}

export function refund(ledger: Ledger, occurrences: Occurrence[]): Ledger {
  const used = { ...ledger.used };
  for (const occ of occurrences) {
    if (occ.turn === ledger.turn) used[occ.taId] = Math.max(0, (used[occ.taId] ?? 0) - 1);
  }
  return { turn: ledger.turn, used };
}
