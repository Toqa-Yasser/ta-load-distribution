import { SERVER_ERROR_MESSAGE } from "~/lib/errors";
import { isTaskKind, type Command } from "~/engine/types";

export const INVALID_COMMAND_MESSAGE = "Invalid command.";

/** JSON 500 for unexpected failures, so fetchers get data (and a toast) instead of an error boundary. */
export function serverError(e: unknown): Response {
  console.error(e);
  return Response.json({ ok: false, message: SERVER_ERROR_MESSAGE }, { status: 500 });
}

export function invalidCommand(): Response {
  return Response.json({ ok: false, message: INVALID_COMMAND_MESSAGE, code: "BAD_REQUEST" }, { status: 400 });
}

function hasTaId(ref: unknown): boolean {
  return typeof ref === "object" && ref !== null && typeof (ref as { taId?: unknown }).taId === "string";
}

/**
 * The `command` of a JSON body, or null unless it is an object with a string `type` (and, for
 * `createTask`, a valid `kind`: the reducer would otherwise index a ledger that does not exist, and
 * a numeric `taCount` when present; for `swapOccurrences`, refs with a string `taId`). Finer checks
 * are the reducer's.
 */
export async function readCommand(request: Request): Promise<Command | null> {
  try {
    const body: unknown = await request.json();
    const command = body && typeof body === "object" ? (body as { command?: unknown }).command : undefined;
    if (!command || typeof command !== "object") return null;
    const { type, kind, taCount, a, b } = command as { type?: unknown; kind?: unknown; taCount?: unknown; a?: unknown; b?: unknown };
    if (typeof type !== "string") return null;
    if (type === "createTask" && !isTaskKind(kind)) return null;
    if (type === "createTask" && taCount !== undefined && typeof taCount !== "number") return null;
    if (type === "swapOccurrences" && !(hasTaId(a) && hasTaId(b))) return null;
    return command as Command;
  } catch {
    return null;
  }
}
