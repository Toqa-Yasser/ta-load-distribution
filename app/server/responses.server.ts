import { SERVER_ERROR_MESSAGE } from "~/lib/errors";
import type { Command } from "~/engine/types";

export const INVALID_COMMAND_MESSAGE = "Invalid command.";

/** JSON 500 for unexpected failures, so fetchers get data (and a toast) instead of an error boundary. */
export function serverError(e: unknown): Response {
  console.error(e);
  return Response.json({ ok: false, message: SERVER_ERROR_MESSAGE }, { status: 500 });
}

export function invalidCommand(): Response {
  return Response.json({ ok: false, message: INVALID_COMMAND_MESSAGE, code: "BAD_REQUEST" }, { status: 400 });
}

/** The `command` of a JSON body, or null unless it is an object with a string `type`. */
export async function readCommand(request: Request): Promise<Command | null> {
  try {
    const body: unknown = await request.json();
    const command = body && typeof body === "object" ? (body as { command?: unknown }).command : undefined;
    if (!command || typeof command !== "object" || typeof (command as { type?: unknown }).type !== "string") return null;
    return command as Command;
  } catch {
    return null;
  }
}
