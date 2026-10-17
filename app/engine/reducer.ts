import { capacities } from "~/engine/capacity";
import { assignOccurrences, refund, refundSeats } from "~/engine/distribute";
import { emptyWorkspace } from "~/engine/empty";
import { newId } from "~/engine/ids";
import { nextTaColor } from "~/engine/palette";
import { seededRng, type Rng } from "~/engine/rng";
import { generateDates } from "~/engine/schedule";
import {
  isTaskKind,
  NotEnoughTAsError,
  TASK_KINDS,
  ValidationError,
  type Command,
  type Ledger,
  type Occurrence,
  type OccurrenceRef,
  type Seat,
  type SeatRef,
  type Task,
  type TaskKind,
  type Workspace,
} from "~/engine/types";

export interface ReduceContext { rng: Rng; now: () => string; newId: (prefix: string) => string }

export function defaultContext(): ReduceContext {
  return { rng: Math.random, now: () => new Date().toISOString(), newId };
}

export function testContext(seed = 1): ReduceContext {
  let n = 0;
  return {
    rng: seededRng(seed),
    now: () => "2026-10-16T12:00:00.000Z",
    newId: (prefix) => `${prefix}_${++n}`,
  };
}

function requireName(value: string, what = "Name"): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${what} is required.`);
  return trimmed;
}

function findTA(ws: Workspace, id: string) {
  const ta = ws.tas.find((t) => t.id === id);
  if (!ta) throw new ValidationError("Unknown TA.");
  return ta;
}

function findSection(ws: Workspace, id: string) {
  const section = ws.sections.find((s) => s.id === id);
  if (!section) throw new ValidationError("Unknown section.");
  return section;
}

function findTask(ws: Workspace, id: string): Task {
  const task = ws.tasks.find((t) => t.id === id);
  if (!task) throw new ValidationError("Unknown task.");
  return task;
}

function findOccurrence(ws: Workspace, ref: OccurrenceRef): Occurrence {
  const occ = findTask(ws, ref.taskId).occurrences.find((o) => o.id === ref.occurrenceId);
  if (!occ) throw new ValidationError("Unknown occurrence.");
  return occ;
}

/** The seat `ref.taId` holds on its occurrence; "Unknown TA." when that TA is not seated there. */
function findSeat(ws: Workspace, ref: SeatRef): { task: Task; occ: Occurrence; seat: Seat } {
  const occ = findOccurrence(ws, ref);
  const seat = occ.seats.find((s) => s.taId === ref.taId);
  if (!seat) throw new ValidationError("Unknown TA.");
  return { task: findTask(ws, ref.taskId), occ, seat };
}

/** Rewrites one occurrence in place, leaving every other task and occurrence as it was. */
function mapOccurrence(ws: Workspace, ref: OccurrenceRef, fn: (o: Occurrence) => Occurrence): Workspace["tasks"] {
  return ws.tasks.map((t) =>
    t.id === ref.taskId ? { ...t, occurrences: t.occurrences.map((o) => (o.id === ref.occurrenceId ? fn(o) : o)) } : t,
  );
}

/**
 * Deals for an existing task. These paths run away from the wizard (removing a TA, redistributing,
 * extending the semester), so a shortage names the task instead of saying "This task".
 */
function dealFor(task: Task, args: Parameters<typeof assignOccurrences>[0]): ReturnType<typeof assignOccurrences> {
  try {
    return assignOccurrences(args);
  } catch (e) {
    if (e instanceof NotEnoughTAsError) throw new NotEnoughTAsError(e.needed, e.available, task.title);
    throw e;
  }
}

/**
 * Re-deals every occurrence of `task` (keeping their ids and dates, seating `task.taCount` TAs on
 * each) on `ledger`; with nothing to deal the task and ledger come back unchanged.
 */
function redeal(task: Task, caps: Record<string, number>, ledger: Ledger, rng: Rng): { ledger: Ledger; task: Task } {
  if (task.occurrences.length === 0) return { ledger, task };
  const assigned = dealFor(task, {
    capacities: caps,
    ledger,
    occurrences: task.occurrences.map((o) => ({ id: o.id, date: o.date })),
    taCount: task.taCount,
    rng,
  });
  const byId = new Map(assigned.occurrences.map((o) => [o.id, o]));
  return { ledger: assigned.ledger, task: { ...task, occurrences: task.occurrences.map((o) => byId.get(o.id) ?? o) } };
}

function withLedger(ws: Workspace, kind: TaskKind, ledger: Ledger): Workspace["ledgers"] {
  return { ...ws.ledgers, [kind]: ledger };
}

function byCreation(tasks: Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((x, y) => (x.task.createdAt < y.task.createdAt ? -1 : x.task.createdAt > y.task.createdAt ? 1 : x.index - y.index))
    .map(({ task }) => task);
}

export function reduce(ws: Workspace, cmd: Command, ctx: ReduceContext): Workspace {
  switch (cmd.type) {
    case "addTA": {
      const name = requireName(cmd.name);
      return { ...ws, tas: [...ws.tas, { id: ctx.newId("ta"), name, color: nextTaColor(ws.tas) }] };
    }

    case "renameTA": {
      findTA(ws, cmd.taId);
      const name = requireName(cmd.name);
      return { ...ws, tas: ws.tas.map((t) => (t.id === cmd.taId ? { ...t, name } : t)) };
    }

    case "removeTA": {
      findTA(ws, cmd.taId);
      const tas = ws.tas.filter((t) => t.id !== cmd.taId);
      const sections = ws.sections.map((s) => ({
        ...s,
        taIds: s.taIds.map((id) => (id === cmd.taId ? null : id)) as typeof s.taIds,
      }));
      const caps = capacities({ ...ws, tas, sections });
      const ledgers = { ...ws.ledgers };
      let tasks = ws.tasks;
      // Each kind refunds its orphaned seats, then refills them on its own ledger, one date at a time
      // in date order across all its tasks (ties: creation order, then occurrence order; the sort is
      // stable). Only the removed TA's seats are dealt again: the other seats of a date stay put.
      for (const kind of TASK_KINDS) {
        const orphans = byCreation(tasks.filter((t) => t.kind === kind))
          .flatMap((task) => task.occurrences.filter((o) => o.seats.some((s) => s.taId === cmd.taId)).map((occ) => ({ task, occ })))
          .sort((x, y) => (x.occ.date < y.occ.date ? -1 : x.occ.date > y.occ.date ? 1 : 0));
        const used = { ...refundSeats(ws.ledgers[kind], orphans.flatMap(({ occ }) => occ.seats.filter((s) => s.taId === cmd.taId))).used };
        delete used[cmd.taId];
        let ledger: Ledger = { turn: ws.ledgers[kind].turn, used };
        const refilled = new Map<Task, Map<string, Occurrence>>();
        for (const { task, occ } of orphans) {
          const dealt = dealFor(task, {
            capacities: caps,
            ledger,
            occurrences: [{ id: occ.id, date: occ.date, seats: occ.seats.filter((s) => s.taId !== cmd.taId) }],
            taCount: task.taCount,
            rng: ctx.rng,
          });
          if (!refilled.has(task)) refilled.set(task, new Map());
          refilled.get(task)!.set(occ.id, dealt.occurrences[0]);
          ledger = dealt.ledger;
        }
        ledgers[kind] = ledger;
        tasks = tasks.map((t) => {
          const byId = refilled.get(t);
          return byId ? { ...t, occurrences: t.occurrences.map((o) => byId.get(o.id) ?? o) } : t;
        });
      }
      return { ...ws, tas, sections, tasks, ledgers };
    }

    case "addSection": {
      const name = requireName(cmd.name);
      return { ...ws, sections: [...ws.sections, { id: ctx.newId("sec"), name, taIds: [null, null] }] };
    }

    case "renameSection": {
      findSection(ws, cmd.sectionId);
      const name = requireName(cmd.name);
      return { ...ws, sections: ws.sections.map((s) => (s.id === cmd.sectionId ? { ...s, name } : s)) };
    }

    case "setSectionSlot": {
      findSection(ws, cmd.sectionId);
      if (cmd.slot !== 0 && cmd.slot !== 1) throw new ValidationError("Invalid slot.");
      if (cmd.taId !== null) findTA(ws, cmd.taId);
      return {
        ...ws,
        sections: ws.sections.map((s) => {
          if (s.id !== cmd.sectionId) return s;
          const taIds: typeof s.taIds = [s.taIds[0], s.taIds[1]];
          taIds[cmd.slot] = cmd.taId;
          return { ...s, taIds };
        }),
      };
    }

    case "removeSection": {
      findSection(ws, cmd.sectionId);
      return { ...ws, sections: ws.sections.filter((s) => s.id !== cmd.sectionId) };
    }

    case "setSemester": {
      const { semester } = cmd;
      if (semester.end < semester.start) throw new ValidationError("Semester end must not be before its start.");
      const prev = ws.semester;
      // An earlier end truncates; a later start drops what now falls before it. Both are refunded.
      const startLater = semester.start > prev.start;
      const keep = (o: Occurrence) => o.date <= semester.end && (!startLater || o.date >= semester.start);
      const ledgers = { ...ws.ledgers };
      for (const kind of TASK_KINDS) {
        const dropped = ws.tasks.filter((t) => t.kind === kind).flatMap((t) => t.occurrences.filter((o) => !keep(o)));
        ledgers[kind] = refund(ws.ledgers[kind], dropped);
      }
      let tasks = ws.tasks.map((t) => ({ ...t, occurrences: t.occurrences.filter(keep) }));

      // A later end extends open-ended recurring tasks: only the new dates are dealt, existing
      // assignments stay put, and each kind's ledger is threaded through its tasks in order.
      if (semester.end > prev.end) {
        const caps = capacities(ws);
        tasks = tasks.map((t) => {
          const s = t.schedule;
          if ((s.type !== "daily" && s.type !== "weekly" && s.type !== "monthly") || s.end !== null) return t;
          const last = t.occurrences.reduce((max, o) => (o.date > max ? o.date : max), prev.end);
          const fresh = generateDates(s, semester).filter((d) => d > last && d >= semester.start);
          if (fresh.length === 0) return t;
          const assigned = dealFor(t, {
            capacities: caps,
            ledger: ledgers[t.kind],
            occurrences: fresh.map((date) => ({ id: ctx.newId("occ"), date })),
            taCount: t.taCount,
            rng: ctx.rng,
          });
          ledgers[t.kind] = assigned.ledger;
          return { ...t, occurrences: [...t.occurrences, ...assigned.occurrences] };
        });
      }
      return { ...ws, semester: { ...semester }, tasks, ledgers };
    }

    case "createTask": {
      const kind: unknown = cmd.kind;
      if (!isTaskKind(kind)) throw new ValidationError("Invalid task kind.");
      const title = requireName(cmd.title, "Title");
      const taCount: unknown = cmd.taCount ?? 1;
      if (typeof taCount !== "number" || !Number.isInteger(taCount) || taCount < 1) {
        throw new ValidationError("TAs per date must be a whole number of at least 1.");
      }
      const dates = generateDates(cmd.schedule, ws.semester);
      if (dates.length === 0) throw new ValidationError("This schedule has no dates.");
      const assigned = assignOccurrences({
        capacities: capacities(ws),
        ledger: ws.ledgers[kind],
        occurrences: dates.map((date) => ({ id: ctx.newId("occ"), date })),
        taCount,
        rng: ctx.rng,
      });
      const task: Task = {
        id: ctx.newId("task"),
        title,
        kind,
        ...(cmd.notes !== undefined ? { notes: cmd.notes } : {}),
        createdAt: ctx.now(),
        schedule: cmd.schedule,
        taCount,
        occurrences: assigned.occurrences,
      };
      return { ...ws, tasks: [...ws.tasks, task], ledgers: withLedger(ws, kind, assigned.ledger) };
    }

    case "reset":
      return emptyWorkspace();

    case "updateTask": {
      const task = findTask(ws, cmd.taskId);
      const title = cmd.title !== undefined ? requireName(cmd.title, "Title") : task.title;
      // undefined keeps the notes, null clears them.
      const notes = cmd.notes === undefined ? task.notes : cmd.notes ?? undefined;
      let next: Task = { ...task, title, notes };
      if (notes === undefined) delete next.notes;
      let ledger = ws.ledgers[task.kind];
      if (cmd.schedule) {
        const dates = generateDates(cmd.schedule, ws.semester);
        if (dates.length === 0) throw new ValidationError("This schedule has no dates.");
        const refunded = refund(ledger, task.occurrences);
        const assigned = assignOccurrences({
          capacities: capacities(ws),
          ledger: refunded,
          occurrences: dates.map((date) => ({ id: ctx.newId("occ"), date })),
          taCount: task.taCount,
          rng: ctx.rng,
        });
        next = { ...next, schedule: cmd.schedule, occurrences: assigned.occurrences };
        ledger = assigned.ledger;
      }
      return { ...ws, tasks: ws.tasks.map((t) => (t.id === task.id ? next : t)), ledgers: withLedger(ws, task.kind, ledger) };
    }

    case "deleteTask": {
      const task = findTask(ws, cmd.taskId);
      const ledger = refund(ws.ledgers[task.kind], task.occurrences);
      return { ...ws, tasks: ws.tasks.filter((t) => t.id !== task.id), ledgers: withLedger(ws, task.kind, ledger) };
    }

    case "redistributeTask": {
      const task = findTask(ws, cmd.taskId);
      const refunded = refund(ws.ledgers[task.kind], task.occurrences);
      const dealt = redeal(task, capacities(ws), refunded, ctx.rng);
      return { ...ws, tasks: ws.tasks.map((t) => (t.id === task.id ? dealt.task : t)), ledgers: withLedger(ws, task.kind, dealt.ledger) };
    }

    case "redistributeAll": {
      // Both ledgers start over; light tasks are re-dealt first, then heavy, each in creation order.
      const caps = capacities(ws);
      const ledgers = {} as Workspace["ledgers"];
      const redealt = new Map<string, Task>();
      for (const kind of TASK_KINDS) {
        let ledger: Ledger = { turn: 1, used: {} };
        for (const task of byCreation(ws.tasks.filter((t) => t.kind === kind))) {
          const dealt = redeal(task, caps, ledger, ctx.rng);
          redealt.set(task.id, dealt.task);
          ledger = dealt.ledger;
        }
        ledgers[kind] = ledger;
      }
      return { ...ws, tasks: ws.tasks.map((t) => redealt.get(t.id) ?? t), ledgers };
    }

    case "reassignOccurrence": {
      const { task, occ, seat } = findSeat(ws, { ...cmd.ref, taId: cmd.from });
      findTA(ws, cmd.taId);
      if (cmd.from === cmd.taId) return ws;
      if (occ.seats.some((s) => s.taId === cmd.taId)) throw new ValidationError("A TA can't hold the same date twice.");
      const ledger = ws.ledgers[task.kind];
      // The seat keeps its turn, so the ledger's `used` keeps counting exactly the current-turn
      // seats each TA holds: a current-turn unit moves with the seat, a past-turn one is already
      // settled and leaves the ledger alone. Either way, reassigning it back restores the ledger.
      const used = { ...ledger.used };
      if (seat.turn === ledger.turn) {
        used[cmd.from] = Math.max(0, (used[cmd.from] ?? 0) - 1);
        used[cmd.taId] = (used[cmd.taId] ?? 0) + 1;
      }
      return {
        ...ws,
        tasks: mapOccurrence(ws, cmd.ref, (o) => ({ ...o, seats: o.seats.map((s) => (s === seat ? { ...s, taId: cmd.taId } : s)) })),
        ledgers: withLedger(ws, task.kind, { turn: ledger.turn, used }),
      };
    }

    case "swapOccurrences": {
      if (cmd.a.taskId === cmd.b.taskId && cmd.a.occurrenceId === cmd.b.occurrenceId) {
        throw new ValidationError("Pick two different occurrences to swap.");
      }
      const a = findSeat(ws, cmd.a);
      const b = findSeat(ws, cmd.b);
      // Turns only mean something within one ledger, so swaps never cross kinds.
      if (a.task.kind !== b.task.kind) throw new ValidationError("Only tasks of the same kind can be swapped.");
      if (cmd.a.taId === cmd.b.taId) return ws;
      if (b.occ.seats.some((s) => s.taId === cmd.a.taId) || a.occ.seats.some((s) => s.taId === cmd.b.taId)) {
        throw new ValidationError("A TA can't hold the same date twice.");
      }
      // The seats trade TA and turn, so each unit stays charged to the turn it was dealt in.
      const trade = (mine: Seat, theirs: Seat) => (o: Occurrence): Occurrence => ({
        ...o,
        seats: o.seats.map((s) => (s === mine ? { taId: theirs.taId, turn: theirs.turn } : s)),
      });
      return { ...ws, tasks: mapOccurrence({ ...ws, tasks: mapOccurrence(ws, cmd.a, trade(a.seat, b.seat)) }, cmd.b, trade(b.seat, a.seat)) };
    }

    default:
      // Commands arrive as JSON from the client; reject anything the union does not cover.
      throw new ValidationError("Unknown command.");
  }
}

function taName(ws: Workspace, id: string): string {
  return ws.tas.find((t) => t.id === id)?.name ?? "TA";
}

function taskTitle(ws: Workspace, id: string): string {
  return ws.tasks.find((t) => t.id === id)?.title ?? "task";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function describe(cmd: Command, ws: Workspace): string {
  switch (cmd.type) {
    case "addTA": return `Added TA "${cmd.name.trim()}"`;
    case "renameTA": return `Renamed TA to "${cmd.name.trim()}"`;
    case "removeTA": return `Removed TA "${taName(ws, cmd.taId)}"`;
    case "addSection": return `Added section "${cmd.name.trim()}"`;
    case "renameSection": return `Renamed section to "${cmd.name.trim()}"`;
    case "setSectionSlot": {
      const section = ws.sections.find((s) => s.id === cmd.sectionId)?.name ?? "section";
      return cmd.taId === null ? `Cleared a slot in ${section}` : `Assigned ${taName(ws, cmd.taId)} to ${section}`;
    }
    case "removeSection": return `Removed section "${ws.sections.find((s) => s.id === cmd.sectionId)?.name ?? "section"}"`;
    case "setSemester": return "Updated semester";
    case "createTask": {
      const label = `Added ${cmd.kind} task "${cmd.title.trim()}"`;
      return cmd.taCount !== undefined && cmd.taCount > 1 ? `${label} for ${cmd.taCount} TAs` : label;
    }
    case "updateTask": return `Updated task "${taskTitle(ws, cmd.taskId)}"`;
    case "deleteTask": return `Deleted task "${taskTitle(ws, cmd.taskId)}"`;
    case "redistributeTask": return `Redistributed "${taskTitle(ws, cmd.taskId)}"`;
    case "redistributeAll": return "Redistributed everything";
    case "reassignOccurrence": {
      const date = ws.tasks.find((t) => t.id === cmd.ref.taskId)?.occurrences.find((o) => o.id === cmd.ref.occurrenceId)?.date;
      return `Reassigned ${date ? formatDay(date) : "occurrence"} to ${taName(ws, cmd.taId)}`;
    }
    case "swapOccurrences": return `Swapped ${taName(ws, cmd.a.taId)} ↔ ${taName(ws, cmd.b.taId)}`;
    case "reset": return "Reset everything";
  }
}
