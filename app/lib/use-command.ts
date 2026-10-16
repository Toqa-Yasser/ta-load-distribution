import { nanoid } from "nanoid";
import { createContext, useCallback, useContext, useRef } from "react";
import { useFetchers, useSubmit } from "react-router";
import type { Command } from "~/engine/types";
import { SERVER_ERROR_MESSAGE } from "~/lib/errors";
import type { ToastInput } from "~/lib/toast";

export type CommandResult =
  | { ok: true; version: number; snapshotId: number; label: string }
  | { ok: false; message: string; code?: string };

/** Every command gets its own fetcher under this prefix; AppShell's <CommandToasts> watches them. */
export const COMMAND_KEY_PREFIX = "cmd:";
export const isCommandKey = (key: string) => key.startsWith(COMMAND_KEY_PREFIX);

/**
 * Registers a just-submitted command key (and its optional toast text) with the shell's
 * watcher. Discovery through useFetchers() alone can miss a command that settles before the
 * shell re-renders, so the submitter announces it too. Null outside the shell: nothing toasts.
 */
export const CommandWatchContext = createContext<((key: string, toast?: string) => void) | null>(null);

/** The toast for a command's result; anything not a well-formed success is an error. */
export function commandToast(data: CommandResult | undefined, undo: (snapshotId: number) => void, override?: string): ToastInput {
  if (data?.ok === true) {
    const { snapshotId } = data;
    // The result toast of Undo ("Rolled back" or the error) comes from AppShell's undo watcher.
    return { message: override ?? data.label, tone: "success", action: { label: "Undo", onClick: () => undo(snapshotId) } };
  }
  const message = data && typeof data.message === "string" && data.message ? data.message : SERVER_ERROR_MESSAGE;
  return { message, tone: "error" };
}

/**
 * Posts commands to /api/command. Each call uses a fresh fetcher key, so concurrent commands
 * never supersede each other's result, and the toast is shown by the shell, so it survives the
 * caller unmounting. `pending` is true while any command this hook submitted is in flight.
 */
export function useCommand(): { submit(cmd: Command, opts?: { toast?: string }): void; pending: boolean } {
  const submitFetch = useSubmit();
  const watch = useContext(CommandWatchContext);
  const mine = useRef(new Set<string>());
  const fetchers = useFetchers();

  const submit = useCallback(
    (cmd: Command, opts?: { toast?: string }) => {
      const key = COMMAND_KEY_PREFIX + nanoid();
      mine.current.add(key);
      watch?.(key, opts?.toast);
      void submitFetch(JSON.stringify({ command: cmd }), {
        method: "post",
        action: "/api/command",
        encType: "application/json",
        navigate: false,
        fetcherKey: key,
      });
    },
    [submitFetch, watch],
  );

  const pending = fetchers.some((f) => f.state !== "idle" && mine.current.has(f.key));
  return { submit, pending };
}
