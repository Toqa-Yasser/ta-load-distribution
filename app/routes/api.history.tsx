import { safeServerAction } from "~/lib/errors";
import { EngineError } from "~/engine/types";
import { getEnv } from "~/server/env.server";
import { serverError } from "~/server/responses.server";
import { getStore } from "~/server/store.server";
import { deleteHistory, rollback, saveSnapshot } from "~/server/workspace.server";
import type { Route } from "./+types/api.history";

type HistoryRequest =
  | { intent: "rollback"; snapshotId: number }
  | { intent: "snapshot"; name: string }
  | { intent: "deleteHistory"; password: string };

const fail = (message: string, status: number, code?: string) =>
  Response.json({ ok: false, message, code }, { status });

export async function action({ request }: Route.ActionArgs) {
  let body: HistoryRequest;
  try {
    body = (await request.json()) as HistoryRequest;
  } catch {
    return fail("Malformed request.", 400, "BAD_REQUEST");
  }
  try {
    const store = getStore();
    switch (body?.intent) {
      case "rollback": {
        const r = await rollback(store, Number(body.snapshotId));
        return Response.json({ ok: true, version: r.version, snapshotId: r.snapshotId });
      }
      case "snapshot": {
        const snapshotId = await saveSnapshot(store, String(body.name ?? ""));
        return Response.json({ ok: true, snapshotId });
      }
      case "deleteHistory": {
        const deleted = await deleteHistory(store, String(body.password ?? ""), getEnv().HISTORY_DELETE_PASSWORD);
        return deleted ? Response.json({ ok: true }) : fail("Wrong password.", 403, "FORBIDDEN");
      }
      default:
        return fail("Unknown intent.", 400, "BAD_REQUEST");
    }
  } catch (e) {
    if (e instanceof EngineError) return fail(e.message, e.code === "NOT_FOUND" ? 404 : 400, e.code);
    return serverError(e);
  }
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  return safeServerAction(serverAction);
}
