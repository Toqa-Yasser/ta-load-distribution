import { capacities } from "~/engine/capacity";
import { assignOccurrences, refund } from "~/engine/distribute";
import { emptyWorkspace } from "~/engine/empty";
import { newId } from "~/engine/ids";
import { nextTaColor } from "~/engine/palette";
import { seededRng, type Rng } from "~/engine/rng";
import { generateDates } from "~/engine/schedule";
import {
  isTaskKind,
  TASK_KINDS,
  ValidationError,
  type Command,
  type Ledger,
  type Occurrence,
  type OccurrenceRef,
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

/**
 * Re-deals `occurrences` (keeping their ids and dates) on `ledger`. `apply` swaps the new
 * assignments into any task that holds them; with nothing to deal it is the identity.
 */
function redeal(
  occurrences: Occurrence[],
  caps: Record<string, number>,
  ledger: Ledger,
  rng: Rng,
): { ledger: Ledger; apply: (task: Task) => Task } {
  if (occurrences.length === 0) return { ledger, apply: (task) => task };
  const assigned = assignOccurrences({
    capacities: caps,
    ledger,
    occurrences: occurrences.map((o) => ({ id: o.id, date: o.date })),
    rng,
  });
  const byId = new Map(assigned.occurrences.map((o) => [o.id, o]));
  return {
    ledger: assigned.ledger,
    apply: (task) => ({ ...task, occurrences: task.occurrences.map((o) => byId.get(o.id) ?? o) }),
  };
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
      // Each kind refunds and re-deals its own orphans on its own ledger.
      for (const kind of TASK_KINDS) {
        const orphaned = ws.tasks
          .filter((t) => t.kind === kind)
          .flatMap((t) => t.occurrences.filter((o) => o.taId === cmd.taId));
        const used = { ...refund(ws.ledgers[kind], orphaned).used };
        delete used[cmd.taId];
        const dealt = redeal(orphaned, caps, { turn: ws.ledgers[kind].turn, used }, ctx.rng);
        ledgers[kind] = dealt.ledger;
        tasks = tasks.map((t) => (t.kind === kind ? dealt.apply(t) : t));
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
          const assigned = assignOccurrences({
            capacities: caps,
            ledger: ledgers[t.kind],
            occurrences: fresh.map((date) => ({ id: ctx.newId("occ"), date })),
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
      const dates = generateDates(cmd.schedule, ws.semester);
      if (dates.length === 0) throw new ValidationError("This schedule has no dates.");
      const assigned = assignOccurrences({
        capacities: capacities(ws),
        ledger: ws.ledgers[kind],
        occurrences: dates.map((date) => ({ id: ctx.newId("occ"), date })),
        rng: ctx.rng,
      });
      const task: Task = {
        id: ctx.newId("task"),
        title,
        kind,
        ...(cmd.notes !== undefined ? { notes: cmd.notes } : {}),
        createdAt: ctx.now(),
        schedule: cmd.schedule,
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
      const dealt = redeal(task.occurrences, capacities(ws), refunded, ctx.rng);
      const next = dealt.apply(task);
      return { ...ws, tasks: ws.tasks.map((t) => (t.id === task.id ? next : t)), ledgers: withLedger(ws, task.kind, dealt.ledger) };
    }

    case "redistributeAll": {
      // Both ledgers start over; light tasks are re-dealt first, then heavy, each in creation order.
      const caps = capacities(ws);
      const ledgers = {} as Workspace["ledgers"];
      const redealt = new Map<string, Task>();
      for (const kind of TASK_KINDS) {
        let ledger: Ledger = { turn: 1, used: {} };
        for (const task of byCreation(ws.tasks.filter((t) => t.kind === kind))) {
          const dealt = redeal(task.occurrences, caps, ledger, ctx.rng);
          redealt.set(task.id, dealt.apply(task));
          ledger = dealt.ledger;
        }
        ledgers[kind] = ledger;
      }
      return { ...ws, tasks: ws.tasks.map((t) => redealt.get(t.id) ?? t), ledgers };
    }

    case "reassignOccurrence": {
      const occ = findOccurrence(ws, cmd.ref);
      findTA(ws, cmd.taId);
      if (occ.taId === cmd.taId) return ws;
      const { kind } = findTask(ws, cmd.ref.taskId);
      const ledger = ws.ledgers[kind];
      const used = { ...ledger.used };
      if (occ.turn === ledger.turn) used[occ.taId] = Math.max(0, (used[occ.taId] ?? 0) - 1);
      used[cmd.taId] = (used[cmd.taId] ?? 0) + 1;
      const moved: Occurrence = { ...occ, taId: cmd.taId, turn: ledger.turn };
      return {
        ...ws,
        tasks: ws.tasks.map((t) =>
          t.id === cmd.ref.taskId ? { ...t, occurrences: t.occurrences.map((o) => (o.id === occ.id ? moved : o)) } : t,
        ),
        ledgers: withLedger(ws, kind, { turn: ledger.turn, used }),
      };
    }

    case "swapOccurrences": {
      if (cmd.a.taskId === cmd.b.taskId && cmd.a.occurrenceId === cmd.b.occurrenceId) {
        throw new ValidationError("Pick two different occurrences to swap.");
      }
      const a = findOccurrence(ws, cmd.a);
      const b = findOccurrence(ws, cmd.b);
      // Turns only mean something within one ledger, so swaps never cross kinds.
      if (findTask(ws, cmd.a.taskId).kind !== findTask(ws, cmd.b.taskId).kind) {
        throw new ValidationError("Only tasks of the same kind can be swapped.");
      }
      return {
        ...ws,
        tasks: ws.tasks.map((t) => ({
          ...t,
          occurrences: t.occurrences.map((o) => {
            if (t.id === cmd.a.taskId && o.id === a.id) return { ...o, taId: b.taId, turn: b.turn };
            if (t.id === cmd.b.taskId && o.id === b.id) return { ...o, taId: a.taId, turn: a.turn };
            return o;
          }),
        })),
      };
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
    case "createTask": return `Added ${cmd.kind} task "${cmd.title.trim()}"`;
    case "updateTask": return `Updated task "${taskTitle(ws, cmd.taskId)}"`;
    case "deleteTask": return `Deleted task "${taskTitle(ws, cmd.taskId)}"`;
    case "redistributeTask": return `Redistributed "${taskTitle(ws, cmd.taskId)}"`;
    case "redistributeAll": return "Redistributed everything";
    case "reassignOccurrence": {
      const date = ws.tasks.find((t) => t.id === cmd.ref.taskId)?.occurrences.find((o) => o.id === cmd.ref.occurrenceId)?.date;
      return `Reassigned ${date ? formatDay(date) : "occurrence"} to ${taName(ws, cmd.taId)}`;
    }
    case "swapOccurrences": {
      const find = (r: { taskId: string; occurrenceId: string }) =>
        ws.tasks.find((t) => t.id === r.taskId)?.occurrences.find((o) => o.id === r.occurrenceId);
      const a = find(cmd.a); const b = find(cmd.b);
      return `Swapped ${a ? taName(ws, a.taId) : "TA"} ↔ ${b ? taName(ws, b.taId) : "TA"}`;
    }
    case "reset": return "Reset everything";
  }
}
