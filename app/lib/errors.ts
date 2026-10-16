export const SERVER_ERROR_MESSAGE = "Something went wrong on the server. Please try again.";

export type ApiFailure = { ok: false; message: string; code?: string };

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
