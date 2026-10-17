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

function isOccurrence(value: unknown): boolean {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.date) &&
    isString(value.taId) &&
    typeof value.turn === "number"
  );
}

function isCurrentTask(value: Doc): boolean {
  return isTaskKind(value.kind) && Array.isArray(value.occurrences) && value.occurrences.every(isOccurrence);
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

/**
 * Brings a stored document up to the current shape. A current document is returned as-is (same
 * reference); a v1.0 document keeps any valid task kinds, the other tasks become light, and its
 * ledger becomes the light ledger. Pure.
 */
export function upgradeWorkspace(doc: unknown): Workspace {
  if (isCurrentWorkspace(doc)) return doc;
  if (isLegacyWorkspace(doc)) {
    const { ledger, ...rest } = doc;
    return {
      ...rest,
      tasks: doc.tasks.map((t) => ({ ...t, kind: isTaskKind(t.kind) ? t.kind : "light" })),
      ledgers: { light: ledger, heavy: { turn: 1, used: {} } },
    } as unknown as Workspace;
  }
  throw new ValidationError("Unrecognised workspace document.");
}
