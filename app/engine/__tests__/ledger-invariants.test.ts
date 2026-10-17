import { reduce, testContext } from "~/engine/reducer";
import type { Occurrence, Seat, Task, TaskKind, Workspace } from "~/engine/types";
import { team } from "./fixtures";

/**
 * The ledger invariant: `ledgers[kind].used[ta]` counts the seats `ta` holds in the current turn
 * across every task of that kind. The one sanctioned excess is carry: units a TA was dealt beyond
 * capacity (co-staffing can require it) move into the next turn without a seat of that turn.
 */
function currentTurnSeats(ws: Workspace, kind: TaskKind): Record<string, number> {
  const turn = ws.ledgers[kind].turn;
  const counts: Record<string, number> = {};
  for (const task of ws.tasks.filter((t) => t.kind === kind)) {
    for (const seat of task.occurrences.flatMap((o) => o.seats)) {
      if (seat.turn === turn) counts[seat.taId] = (counts[seat.taId] ?? 0) + 1;
    }
  }
  return counts;
}

function expectLedgerMatchesSeats(ws: Workspace, kind: TaskKind) {
  const recount = currentTurnSeats(ws, kind);
  for (const ta of ws.tas) expect(ws.ledgers[kind].used[ta.id] ?? 0).toBe(recount[ta.id] ?? 0);
}

/** A 2-TA daily light task on the A1 B2 C2 D3 team: 6 dates × 2 seats spans the 8-unit turn 1 into turn 2. */
function pairAcrossRollover() {
  const ctx = testContext();
  const { ws, id } = team();
  const out = reduce(ws, { type: "createTask", kind: "light", title: "Pair", taCount: 2, schedule: { type: "daily", start: "2026-10-01", end: "2026-10-06" } }, ctx);
  return { ws: out, id, ctx, task: out.tasks[0] };
}

const ref = (task: Task, occ: Occurrence) => ({ taskId: task.id, occurrenceId: occ.id });

/** First seat dealt in `turn`, with a TA from `tas` who does not sit on its date. */
function seatInTurn(task: Task, turn: number, tas: string[]): { occ: Occurrence; seat: Seat; free: string } {
  for (const occ of task.occurrences) {
    for (const seat of occ.seats.filter((s) => s.turn === turn)) {
      const free = tas.find((id) => !occ.seats.some((s) => s.taId === id));
      if (free) return { occ, seat, free };
    }
  }
  throw new Error(`no seat in turn ${turn}`);
}

test("a swap between a turn-1 seat and a turn-2 seat keeps the ledger equal to the recount", () => {
  const { ws, ctx, task } = pairAcrossRollover();
  expect(ws.ledgers.light.turn).toBe(2);
  expectLedgerMatchesSeats(ws, "light");
  // Two seats on different dates, from different turns, whose TAs can trade places.
  const pairs = task.occurrences.flatMap((a) =>
    a.seats.filter((x) => x.turn === 1).flatMap((x) =>
      task.occurrences.flatMap((b) =>
        b.seats
          .filter((y) => y.turn === 2 && b !== a && !b.seats.some((s) => s.taId === x.taId) && !a.seats.some((s) => s.taId === y.taId))
          .map((y) => ({ a, x, b, y })),
      ),
    ),
  );
  expect(pairs.length).toBeGreaterThan(0);
  const { a, x, b, y } = pairs[0];
  const out = reduce(ws, { type: "swapOccurrences", a: { ...ref(task, a), taId: x.taId }, b: { ...ref(task, b), taId: y.taId } }, ctx);
  expect(out.tasks[0]).not.toEqual(task);
  expectLedgerMatchesSeats(out, "light");
});

test("reassigning a current-turn seat and a past-turn seat keeps the ledger equal to the recount", () => {
  const { ws, ctx, task } = pairAcrossRollover();
  const tas = ws.tas.map((t) => t.id);
  const current = seatInTurn(task, ws.ledgers.light.turn, tas);
  let out = reduce(ws, { type: "reassignOccurrence", ref: ref(task, current.occ), from: current.seat.taId, taId: current.free }, ctx);
  expect(out.ledgers.light).not.toEqual(ws.ledgers.light);
  expectLedgerMatchesSeats(out, "light");
  const past = seatInTurn(out.tasks[0], 1, tas);
  const ledger = out.ledgers.light;
  out = reduce(out, { type: "reassignOccurrence", ref: ref(out.tasks[0], past.occ), from: past.seat.taId, taId: past.free }, ctx);
  expect(out.ledgers.light).toEqual(ledger);
  expectLedgerMatchesSeats(out, "light");
});

test("a removeTA refill that rolls the turn over never under-counts, and only carry exceeds the recount", () => {
  const { ws, id, ctx } = pairAcrossRollover();
  const out = reduce(ws, { type: "removeTA", taId: id("D") }, ctx);
  // D held a seat on most dates; refilling them on A1 B2 C2 (5 units a turn) fills turn 2 and opens turn 3.
  expect(out.ledgers.light.turn).toBe(3);
  const recount = currentTurnSeats(out, "light");
  for (const ta of out.tas) expect(out.ledgers.light.used[ta.id] ?? 0).toBeGreaterThanOrEqual(recount[ta.id] ?? 0);
  // Carry: refilling Oct 3 in turn 2, B already sat on the date and C was full, so A was seated
  // beyond its single unit (overshoot). At the rollover that excess carried into turn 3: A starts
  // it with 1 unit used and no turn-3 seat behind it. Everyone else matches the recount exactly.
  expect(out.ledgers.light.used[id("A")]).toBe(1);
  expect(recount[id("A")] ?? 0).toBe(0);
  for (const name of ["B", "C"]) expect(out.ledgers.light.used[id(name)] ?? 0).toBe(recount[id(name)] ?? 0);
});
