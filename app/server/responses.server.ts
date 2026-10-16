import { SERVER_ERROR_MESSAGE } from "~/lib/errors";

/** JSON 500 for unexpected failures, so fetchers get data (and a toast) instead of an error boundary. */
export function serverError(e: unknown): Response {
  console.error(e);
  return Response.json({ ok: false, message: SERVER_ERROR_MESSAGE }, { status: 500 });
}
