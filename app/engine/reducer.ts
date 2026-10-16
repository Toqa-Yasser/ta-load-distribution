import { nextTaColor } from "~/lib/ta-colors";
import { capacities } from "~/engine/capacity";
import { assignOccurrences, refund } from "~/engine/distribute";
import { emptyWorkspace } from "~/engine/empty";
import { newId } from "~/engine/ids";
import { seededRng, type Rng } from "~/engine/rng";
import { generateDates } from "~/engine/schedule";
import { ValidationError, type Command, type Occurrence, type Task, type Workspace } from "~/engine/types";

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
      const orphaned: Occurrence[] = ws.tasks.flatMap((t) => t.occurrences.filter((o) => o.taId === cmd.taId));
      const used = { ...refund(ws.ledger, orphaned).used };
      delete used[cmd.taId];
      const base: Workspace = { ...ws, tas, sections, ledger: { turn: ws.ledger.turn, used } };
      if (orphaned.length === 0) return base;

      const assigned = assignOccurrences({
        capacities: capacities(base),
        ledger: base.ledger,
        occurrences: orphaned.map((o) => ({ id: o.id, date: o.date })),
        rng: ctx.rng,
      });
      const byId = new Map(assigned.occurrences.map((o) => [o.id, o]));
      const tasks = ws.tasks.map((t) => ({
        ...t,
        occurrences: t.occurrences.map((o) => byId.get(o.id) ?? o),
      }));
      return { ...base, tasks, ledger: assigned.ledger };
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
      const dropped: Occurrence[] = ws.tasks.flatMap((t) => t.occurrences.filter((o) => o.date > semester.end));
      const tasks = ws.tasks.map((t) => ({ ...t, occurrences: t.occurrences.filter((o) => o.date <= semester.end) }));
      return { ...ws, semester: { ...semester }, tasks, ledger: refund(ws.ledger, dropped) };
    }

    case "createTask": {
      const title = requireName(cmd.title, "Title");
      const dates = generateDates(cmd.schedule, ws.semester);
      if (dates.length === 0) throw new ValidationError("This schedule has no dates.");
      const assigned = assignOccurrences({
        capacities: capacities(ws),
        ledger: ws.ledger,
        occurrences: dates.map((date) => ({ id: ctx.newId("occ"), date })),
        rng: ctx.rng,
      });
      const task: Task = {
        id: ctx.newId("task"),
        title,
        ...(cmd.notes !== undefined ? { notes: cmd.notes } : {}),
        createdAt: ctx.now(),
        schedule: cmd.schedule,
        occurrences: assigned.occurrences,
      };
      return { ...ws, tasks: [...ws.tasks, task], ledger: assigned.ledger };
    }

    case "reset":
      return emptyWorkspace();

    case "updateTask":
    case "deleteTask":
    case "redistributeTask":
    case "redistributeAll":
    case "reassignOccurrence":
    case "swapOccurrences":
      throw new ValidationError("Not implemented");
  }
}

function taName(ws: Workspace, id: string): string {
  return ws.tas.find((t) => t.id === id)?.name ?? "TA";
}

function taskTitle(ws: Workspace, id: string): string {
  return ws.tasks.find((t) => t.id === id)?.title ?? "task";
}

function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
    case "createTask": return `Added task "${cmd.title.trim()}"`;
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
