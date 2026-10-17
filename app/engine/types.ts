export type ISODate = string;

export interface TA { id: string; name: string; color: string }

export interface Section { id: string; name: string; taIds: [string | null, string | null] }

export type Schedule =
  | { type: "one-time"; date: ISODate }
  | { type: "daily" | "weekly" | "monthly"; start: ISODate; end: ISODate | null }
  | { type: "custom"; start: ISODate; count: number; gapDays: number; dates: ISODate[] };

/** One TA covering one date, charged against the ledger of the turn it was dealt in. */
export interface Seat { taId: string; turn: number }

/** A date of a task; `seats` holds one entry per co-staffing TA, all distinct. */
export interface Occurrence { id: string; date: ISODate; seats: Seat[] }

export type TaskKind = "light" | "heavy";

/** Light and heavy tasks are shared out independently, each with its own turn ledger. */
export const TASK_KINDS = ["light", "heavy"] as const satisfies readonly TaskKind[];

/** Display name of each kind; shared by the badge, filters, gauges and calendar pills. */
export const KIND_LABEL: Record<TaskKind, string> = { light: "Light", heavy: "Heavy" };

export function isTaskKind(value: unknown): value is TaskKind {
  return (TASK_KINDS as readonly unknown[]).includes(value);
}

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  notes?: string;
  createdAt: string;
  schedule: Schedule;
  /** How many distinct TAs cover each date. */
  taCount: number;
  occurrences: Occurrence[];
}

export interface Ledger { turn: number; used: Record<string, number> }

export interface Semester { name: string; start: ISODate; end: ISODate }

export interface Workspace { semester: Semester; tas: TA[]; sections: Section[]; tasks: Task[]; ledgers: Record<TaskKind, Ledger> }

export type OccurrenceRef = { taskId: string; occurrenceId: string };

/** One specific TA's seat on an occurrence. */
export type SeatRef = OccurrenceRef & { taId: string };

export type Command =
  | { type: "addTA"; name: string }
  | { type: "renameTA"; taId: string; name: string }
  | { type: "removeTA"; taId: string }
  | { type: "addSection"; name: string }
  | { type: "renameSection"; sectionId: string; name: string }
  | { type: "setSectionSlot"; sectionId: string; slot: 0 | 1; taId: string | null }
  | { type: "removeSection"; sectionId: string }
  | { type: "setSemester"; semester: Semester }
  | { type: "createTask"; kind: TaskKind; title: string; notes?: string; schedule: Schedule; taCount?: number }
  /** `notes: null` clears the notes; omitting it keeps them. The kind cannot be changed. */
  | { type: "updateTask"; taskId: string; title?: string; notes?: string | null; schedule?: Schedule }
  | { type: "deleteTask"; taskId: string }
  | { type: "redistributeTask"; taskId: string }
  | { type: "redistributeAll" }
  | { type: "reassignOccurrence"; ref: OccurrenceRef; from: string; taId: string }
  | { type: "swapOccurrences"; a: SeatRef; b: SeatRef }
  | { type: "reset" };

export class EngineError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "EngineError";
  }
}

export class NoCapacityError extends EngineError {
  constructor() {
    super("Assign sections to at least one TA first.", "NO_CAPACITY");
    this.name = "NoCapacityError";
  }
}

export class NotEnoughTAsError extends EngineError {
  constructor(public readonly needed: number, public readonly available: number) {
    super(`This task needs ${needed} TAs but only ${available} ${available === 1 ? "has" : "have"} sections.`, "NOT_ENOUGH_TAS");
    this.name = "NotEnoughTAsError";
  }
}

export class ValidationError extends EngineError {
  constructor(message: string) {
    super(message, "VALIDATION");
    this.name = "ValidationError";
  }
}

export class TooManyOccurrencesError extends EngineError {
  constructor() {
    super("This schedule creates more than 500 occurrences.", "TOO_MANY");
    this.name = "TooManyOccurrencesError";
  }
}
