import { isTaskKind, ValidationError, type Ledger, type Workspace } from "~/engine/types";

type Doc = Record<string, unknown>;

function isObject(value: unknown): value is Doc {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLedger(value: unknown): value is Ledger {
  return isObject(value) && typeof value.turn === "number" && isObject(value.used);
}

/** Semester, TAs, sections and a task list: the parts both shapes share. */
function hasCommonShape(doc: unknown): doc is Doc & { tas: unknown[]; sections: unknown[]; tasks: Doc[] } {
  return (
    isObject(doc) &&
    isObject(doc.semester) &&
    Array.isArray(doc.tas) &&
    Array.isArray(doc.sections) &&
    Array.isArray(doc.tasks) &&
    doc.tasks.every(isObject)
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isTA(value: unknown): boolean {
  return isObject(value) && isString(value.id) && isString(value.name) && isString(value.color);
}

function isSlot(value: unknown): boolean {
  return value === null || isString(value);
}

function isSection(value: unknown): boolean {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    Array.isArray(value.taIds) &&
    value.taIds.length === 2 &&
    value.taIds.every(isSlot)
  );
}

function isSeat(value: unknown): boolean {
  return isObject(value) && isString(value.taId) && typeof value.turn === "number";
}

function hasIdAndDate(value: unknown): value is Doc {
  return isObject(value) && isString(value.id) && isString(value.date);
}

function isOccurrence(value: unknown): boolean {
  return hasIdAndDate(value) && Array.isArray(value.seats) && value.seats.length > 0 && value.seats.every(isSeat);
}

/** A v1.1 occurrence (one TA, no seats) or one already holding seats. */
function isV11Occurrence(value: unknown): boolean {
  return hasIdAndDate(value) && ("seats" in value ? isOccurrence(value) : isSeat(value));
}

function hasTaCount(value: Doc): boolean {
  return typeof value.taCount === "number" && Number.isInteger(value.taCount) && value.taCount >= 1;
}

function isCurrentTask(value: Doc): boolean {
  return (
    isTaskKind(value.kind) &&
    hasTaCount(value) &&
    Array.isArray(value.occurrences) &&
    value.occurrences.every(isOccurrence)
  );
}

function isV11Task(value: Doc): boolean {
  return isTaskKind(value.kind) && Array.isArray(value.occurrences) && value.occurrences.every(isV11Occurrence);
}

export function isCurrentWorkspace(doc: unknown): doc is Workspace {
  return (
    hasCommonShape(doc) &&
    !("ledger" in doc) &&
    isObject(doc.ledgers) &&
    isLedger(doc.ledgers.light) &&
    isLedger(doc.ledgers.heavy) &&
    doc.tas.every(isTA) &&
    doc.sections.every(isSection) &&
    doc.tasks.every(isCurrentTask)
  );
}

/**
 * v1.0 documents: one `ledger` and (normally) tasks without a `kind`. Mixed documents, where some
 * tasks already carry a kind, are accepted too.
 */
function isLegacyWorkspace(doc: unknown): doc is Doc & { tasks: Doc[]; ledger: Ledger } {
  return hasCommonShape(doc) && !("ledgers" in doc) && isLedger(doc.ledger);
}

/** v1.1 documents: `ledgers` and task kinds, but one TA per occurrence and no `taCount`. */
function isV11Workspace(doc: unknown): doc is Doc & { tasks: Doc[] } {
  return (
    hasCommonShape(doc) &&
    !("ledger" in doc) &&
    isObject(doc.ledgers) &&
    isLedger(doc.ledgers.light) &&
    isLedger(doc.ledgers.heavy) &&
    doc.tas.every(isTA) &&
    doc.sections.every(isSection) &&
    doc.tasks.every(isV11Task)
  );
}

function upgradeV10(doc: Doc & { tasks: Doc[]; ledger: Ledger }): Doc {
  const { ledger, ...rest } = doc;
  return {
    ...rest,
    tasks: doc.tasks.map((t) => ({ ...t, kind: isTaskKind(t.kind) ? t.kind : "light" })),
    ledgers: { light: ledger, heavy: { turn: 1, used: {} } },
  };
}

function upgradeV11(doc: Doc & { tasks: Doc[] }): Workspace {
  return {
    ...doc,
    tasks: doc.tasks.map((t) => ({
      ...t,
      taCount: hasTaCount(t) ? t.taCount : 1,
      occurrences: (t.occurrences as Doc[]).map((o) => {
        if ("seats" in o) return o;
        const { taId, turn, ...rest } = o;
        return { ...rest, seats: [{ taId, turn }] };
      }),
    })),
  } as unknown as Workspace;
}

/**
 * Brings a stored document up to the current shape. A current document is returned as-is (same
 * reference). A v1.0 document keeps any valid task kinds, the other tasks become light, and its
 * ledger becomes the light ledger; a v1.1 document gets one seat per occurrence and `taCount: 1`
 * on tasks without one. Pure.
 */
export function upgradeWorkspace(doc: unknown): Workspace {
  if (isCurrentWorkspace(doc)) return doc;
  const v11 = isLegacyWorkspace(doc) ? upgradeV10(doc) : doc;
  if (isV11Workspace(v11)) return upgradeV11(v11);
  throw new ValidationError("Unrecognised workspace document.");
}
