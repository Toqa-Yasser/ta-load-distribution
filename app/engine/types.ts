export type ISODate = string;

export interface TA { id: string; name: string; color: string }

export interface Section { id: string; name: string; taIds: [string | null, string | null] }

export type Schedule =
  | { type: "one-time"; date: ISODate }
  | { type: "daily" | "weekly" | "monthly"; start: ISODate; end: ISODate | null }
  | { type: "custom"; start: ISODate; count: number; gapDays: number; dates: ISODate[] };

export interface Occurrence { id: string; date: ISODate; taId: string; turn: number }

export interface Task { id: string; title: string; notes?: string; createdAt: string; schedule: Schedule; occurrences: Occurrence[] }

export interface Ledger { turn: number; used: Record<string, number> }

export interface Semester { name: string; start: ISODate; end: ISODate }

export interface Workspace { semester: Semester; tas: TA[]; sections: Section[]; tasks: Task[]; ledger: Ledger }

export type OccurrenceRef = { taskId: string; occurrenceId: string };

export type Command =
  | { type: "addTA"; name: string }
  | { type: "renameTA"; taId: string; name: string }
  | { type: "removeTA"; taId: string }
  | { type: "addSection"; name: string }
  | { type: "renameSection"; sectionId: string; name: string }
  | { type: "setSectionSlot"; sectionId: string; slot: 0 | 1; taId: string | null }
  | { type: "removeSection"; sectionId: string }
  | { type: "setSemester"; semester: Semester }
  | { type: "createTask"; title: string; notes?: string; schedule: Schedule }
  | { type: "updateTask"; taskId: string; title?: string; notes?: string; schedule?: Schedule }
  | { type: "deleteTask"; taskId: string }
  | { type: "redistributeTask"; taskId: string }
  | { type: "redistributeAll" }
  | { type: "reassignOccurrence"; ref: OccurrenceRef; taId: string }
  | { type: "swapOccurrences"; a: OccurrenceRef; b: OccurrenceRef }
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
