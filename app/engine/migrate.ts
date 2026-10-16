import { isTaskKind, ValidationError, type Ledger, type Workspace } from "~/engine/types";

type Doc = Record<string, unknown>;

function isObject(value: unknown): value is Doc {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLedger(value: unknown): value is Ledger {
  return isObject(value) && typeof value.turn === "number" && isObject(value.used);
}

/** Semester, TAs, sections and a task list: the parts both shapes share. */
function hasCommonShape(doc: unknown): doc is Doc & { tasks: unknown[] } {
  return (
    isObject(doc) &&
    isObject(doc.semester) &&
    Array.isArray(doc.tas) &&
    Array.isArray(doc.sections) &&
    Array.isArray(doc.tasks) &&
    doc.tasks.every(isObject)
  );
}

export function isCurrentWorkspace(doc: unknown): doc is Workspace {
  return (
    hasCommonShape(doc) &&
    !("ledger" in doc) &&
    isObject(doc.ledgers) &&
    isLedger(doc.ledgers.light) &&
    isLedger(doc.ledgers.heavy) &&
    doc.tasks.every((t) => isTaskKind((t as Doc).kind))
  );
}

/** v1.0 documents: one `ledger` and tasks without a `kind`. */
function isLegacyWorkspace(doc: unknown): doc is Doc & { tasks: Doc[]; ledger: Ledger } {
  return (
    hasCommonShape(doc) &&
    !("ledgers" in doc) &&
    isLedger(doc.ledger) &&
    doc.tasks.every((t) => !("kind" in (t as Doc)))
  );
}

/**
 * Brings a stored document up to the current shape. A current document is returned as-is (same
 * reference); a v1.0 document becomes all-light with its ledger as the light ledger. Pure.
 */
export function upgradeWorkspace(doc: unknown): Workspace {
  if (isCurrentWorkspace(doc)) return doc;
  if (isLegacyWorkspace(doc)) {
    const { ledger, ...rest } = doc;
    return {
      ...rest,
      tasks: doc.tasks.map((t) => ({ ...t, kind: "light" })),
      ledgers: { light: ledger, heavy: { turn: 1, used: {} } },
    } as unknown as Workspace;
  }
  throw new ValidationError("Unrecognised workspace document.");
}
