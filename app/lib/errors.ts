export const SERVER_ERROR_MESSAGE = "Something went wrong on the server. Please try again.";

/** Shown by the root ErrorBoundary when the stored workspace document fails validation on load. */
export const UNREADABLE_WORKSPACE_MESSAGE = "This workspace document could not be read — restore a snapshot or reset.";

export type ApiFailure = { ok: false; message: string; code?: string };

/** The server's message from a failed API result, or the generic one when it has none. */
export function messageOf(data: unknown): string {
  const message = (data as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message ? message : SERVER_ERROR_MESSAGE;
}

/**
 * Body of the resource routes' `clientAction`: forwards to the server action and turns a
 * thrown error (network failure, non-JSON 5xx) into data, so fetchers show a toast instead
 * of bubbling to the root ErrorBoundary and replacing the whole shell.
 */
export async function safeServerAction<T>(serverAction: () => Promise<T>): Promise<T | ApiFailure> {
  try {
    return await serverAction();
  } catch (e) {
    console.error(e);
    return { ok: false, message: SERVER_ERROR_MESSAGE };
  }
}
