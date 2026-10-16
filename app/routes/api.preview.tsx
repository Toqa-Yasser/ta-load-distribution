import { EngineError, type Command } from "~/engine/types";
import { getStore } from "~/server/store.server";
import { previewCommand } from "~/server/workspace.server";
import type { Route } from "./+types/api.preview";

export async function action({ request }: Route.ActionArgs) {
  let command: Command;
  try {
    ({ command } = (await request.json()) as { command: Command });
    if (!command || typeof command.type !== "string") throw new Error();
  } catch {
    return Response.json({ ok: false, message: "Malformed command.", code: "BAD_REQUEST" }, { status: 400 });
  }
  try {
    const workspace = await previewCommand(getStore(), command);
    return Response.json({ ok: true, workspace });
  } catch (e) {
    if (e instanceof EngineError) {
      return Response.json({ ok: false, message: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
