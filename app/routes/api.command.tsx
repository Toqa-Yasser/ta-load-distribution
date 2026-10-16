import { describe } from "~/engine/reducer";
import { EngineError, type Command } from "~/engine/types";
import { getStore } from "~/server/store.server";
import { applyCommand, loadWorkspace } from "~/server/workspace.server";
import type { Route } from "./+types/api.command";

export async function action({ request }: Route.ActionArgs) {
  let command: Command;
  try {
    ({ command } = (await request.json()) as { command: Command });
    if (!command || typeof command.type !== "string") throw new Error();
  } catch {
    return Response.json({ ok: false, message: "Malformed command.", code: "BAD_REQUEST" }, { status: 400 });
  }
  const store = getStore();
  try {
    const { data: old } = await loadWorkspace(store);
    const label = describe(command, old);
    const r = await applyCommand(store, command);
    return Response.json({ ok: true, version: r.version, snapshotId: r.snapshotId, label });
  } catch (e) {
    if (e instanceof EngineError) {
      return Response.json({ ok: false, message: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
