import { safeServerAction } from "~/lib/errors";
import { EngineError } from "~/engine/types";
import { invalidCommand, readCommand, serverError } from "~/server/responses.server";
import { getStore } from "~/server/store.server";
import { previewCommand } from "~/server/workspace.server";
import type { Route } from "./+types/api.preview";

export async function action({ request }: Route.ActionArgs) {
  const command = await readCommand(request);
  if (!command) return invalidCommand();
  try {
    const workspace = await previewCommand(getStore(), command);
    return Response.json({ ok: true, workspace });
  } catch (e) {
    if (e instanceof EngineError) {
      return Response.json({ ok: false, message: e.message, code: e.code }, { status: 400 });
    }
    return serverError(e);
  }
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  return safeServerAction(serverAction);
}
