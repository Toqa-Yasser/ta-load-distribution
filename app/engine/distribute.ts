import { remainingFraction } from "~/engine/capacity";
import { pick, type Rng } from "~/engine/rng";
import { NoCapacityError, NotEnoughTAsError, type ISODate, type Ledger, type Occurrence, type Seat } from "~/engine/types";

/** `seats` are already held (a refill) and are kept as they are, never charged again. */
export interface PendingOccurrence { id: string; date: ISODate; seats?: Seat[] }

const EPSILON = 1e-9;

/** Highest remaining fraction among `candidates`; ties are broken by the rng. */
function pickFairest(candidates: string[], capacities: Record<string, number>, used: Record<string, number>, rng: Rng): string {
  const fractions = candidates.map((id) => remainingFraction(capacities[id], used[id] ?? 0));
  const best = Math.max(...fractions);
  return pick(candidates.filter((_, i) => Math.abs(fractions[i] - best) <= EPSILON), rng);
}

/**
 * Seats `taCount` distinct TAs on every occurrence, in date order. Both eligibility
 * checks run up front so a failed deal changes nothing.
 */
export function assignOccurrences(args: {
  capacities: Record<string, number>;
  ledger: Ledger;
  occurrences: PendingOccurrence[];
  taCount: number;
  rng: Rng;
}): { ledger: Ledger; occurrences: Occurrence[] } {
  const { capacities, taCount, rng } = args;
  const eligible = Object.keys(capacities).filter((id) => capacities[id] > 0);
  if (eligible.length === 0) throw new NoCapacityError();
  if (eligible.length < taCount) throw new NotEnoughTAsError(taCount, eligible.length);

  let turn = args.ledger.turn;
  let used: Record<string, number> = { ...args.ledger.used };
  const sorted = [...args.occurrences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: Occurrence[] = [];

  for (const occ of sorted) {
    const kept = occ.seats ?? [];
    const seats = [...kept];
    while (seats.length < taCount) {
      const open = eligible.filter((id) => !seats.some((s) => s.taId === id));
      // The turn ends when nobody who could still take this seat has room left. Checked per
      // seat, not per date, so a co-staffed date never pushes a TA beyond their capacity: its
      // later seats simply open the next turn.
      if (open.every((id) => (used[id] ?? 0) >= capacities[id])) {
        turn += 1;
        used = {};
      }
      const taId = pickFairest(open, capacities, used, rng);
      used[taId] = (used[taId] ?? 0) + 1;
      seats.push({ taId, turn });
    }
    out.push({ id: occ.id, date: occ.date, seats });
  }

  return { ledger: { turn, used }, occurrences: out };
}

/** Releases the units held by seats of the current turn; older turns are already closed. */
export function refundSeats(ledger: Ledger, seats: Seat[]): Ledger {
  const used = { ...ledger.used };
  for (const seat of seats) {
    if (seat.turn === ledger.turn) used[seat.taId] = Math.max(0, (used[seat.taId] ?? 0) - 1);
  }
  return { turn: ledger.turn, used };
}

export function refund(ledger: Ledger, occurrences: Occurrence[]): Ledger {
  return refundSeats(ledger, occurrences.flatMap((o) => o.seats));
}
