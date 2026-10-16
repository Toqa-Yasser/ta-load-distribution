import { nanoid } from "nanoid";
import { createContext, useCallback, useContext, useRef } from "react";
import { useFetchers, useSubmit } from "react-router";
import type { Command } from "~/engine/types";
import { messageOf } from "~/lib/errors";
import type { ToastInput } from "~/lib/toast";

export type CommandResult =
  | { ok: true; version: number; snapshotId: number; label: string }
  | { ok: false; message: string; code?: string };

export type SubmitOptions = {
  /** Called once with the result, after the router has revalidated (the fetcher is idle again). */
  onSettled?: (result: CommandResult) => void;
  /**
   * The caller shows a failure inline, so no error toast. Success still toasts (with Undo). A
   * function is asked when the result arrives, e.g. "is the form that shows the error still open?".
   */
  inlineError?: boolean | (() => boolean);
};

/** Every command gets its own fetcher under this prefix; AppShell's <CommandToasts> watches them. */
export const COMMAND_KEY_PREFIX = "cmd:";
export const isCommandKey = (key: string) => key.startsWith(COMMAND_KEY_PREFIX);

/**
 * A watched command whose fetcher is still idle with no data this long after it was announced
 * never ran (or finished without a result); it settles as a failure rather than waiting forever.
 */
export const COMMAND_STALL_MS = 2000;

/**
 * Registers a just-submitted command key (and its options) with the shell's watcher. Discovery
 * through useFetchers() alone can miss a command that settles before the shell re-renders, so
 * the submitter announces it too. Null outside the shell: nothing toasts or settles.
 */
export const CommandWatchContext = createContext<((key: string, opts?: SubmitOptions) => void) | null>(null);

/** A fetcher's final data as a CommandResult; anything not a well-formed success is a failure. */
export function settledResult(data: unknown): CommandResult {
  const d = data as { ok?: unknown; code?: unknown } | undefined;
  if (d?.ok === true) return data as CommandResult;
  return typeof d?.code === "string" ? { ok: false, message: messageOf(d), code: d.code } : { ok: false, message: messageOf(d) };
}

/** The toast for a command's result. */
export function commandToast(result: CommandResult, undo: (snapshotId: number) => void): ToastInput {
  if (result.ok) {
    const { snapshotId } = result;
    // The result toast of Undo ("Rolled back" or the error) comes from AppShell's undo watcher.
    return { message: result.label, tone: "success", action: { label: "Undo", onClick: () => undo(snapshotId) } };
  }
  return { message: result.message, tone: "error" };
}

/**
 * Posts commands to /api/command. Each call uses a fresh fetcher key (returned), so concurrent
 * commands never supersede each other's result, and the toast is shown by the shell, so it
 * survives the caller unmounting. `pending` is true while any command this hook submitted is in flight.
 */
export function useCommand(): { submit(cmd: Command, opts?: SubmitOptions): string; pending: boolean } {
  const submitFetch = useSubmit();
  const watch = useContext(CommandWatchContext);
  const mine = useRef(new Set<string>());
  const fetchers = useFetchers();

  const submit = useCallback(
    (cmd: Command, opts?: SubmitOptions) => {
      const key = COMMAND_KEY_PREFIX + nanoid();
      mine.current.add(key);
      watch?.(key, opts);
      void submitFetch(JSON.stringify({ command: cmd }), {
        method: "post",
        action: "/api/command",
        encType: "application/json",
        navigate: false,
        fetcherKey: key,
      });
      return key;
    },
    [submitFetch, watch],
  );

  const pending = fetchers.some((f) => f.state !== "idle" && mine.current.has(f.key));
  return { submit, pending };
}
