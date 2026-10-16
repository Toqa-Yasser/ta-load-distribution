import { safeServerAction } from "~/lib/errors";
import { EngineError } from "~/engine/types";
import { invalidCommand, readCommand, serverError } from "~/server/responses.server";
import { getStore } from "~/server/store.server";
import { applyCommand, describeCommand, loadWorkspace } from "~/server/workspace.server";
import type { Route } from "./+types/api.command";

export async function action({ request }: Route.ActionArgs) {
  const command = await readCommand(request);
  if (!command) return invalidCommand();
  try {
    const store = getStore();
    const { data: old } = await loadWorkspace(store);
    const label = describeCommand(command, old);
    const r = await applyCommand(store, command);
    return Response.json({ ok: true, version: r.version, snapshotId: r.snapshotId, label });
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
