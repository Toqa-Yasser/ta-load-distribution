import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { useToast } from "~/components/ui/Toast";
import type { Command } from "~/engine/types";
import { SERVER_ERROR_MESSAGE } from "~/lib/errors";
import { useUndo } from "~/lib/use-history";

type CommandResult =
  | { ok: true; version: number; snapshotId: number; label: string }
  | { ok: false; message: string; code?: string };

export function useCommand(): { submit(cmd: Command, opts?: { toast?: string }): void; pending: boolean } {
  const fetcher = useFetcher<CommandResult>();
  const undo = useUndo();
  const toast = useToast();
  const toastOverride = useRef<string | undefined>(undefined);
  const handled = useRef<CommandResult | undefined>(undefined);

  useEffect(() => {
    const data = fetcher.data;
    if (fetcher.state !== "idle" || data === undefined || handled.current === data) return;
    handled.current = data;
    if (data?.ok === true) {
      const { snapshotId } = data;
      toast({
        message: toastOverride.current ?? data.label,
        tone: "success",
        // The result toast ("Rolled back" or the error) comes from AppShell's undo watcher.
        action: { label: "Undo", onClick: () => undo(snapshotId) },
      });
    } else {
      // Anything that is not a well-formed success is an error, even a malformed body.
      const message = data && typeof data.message === "string" && data.message ? data.message : SERVER_ERROR_MESSAGE;
      toast({ message, tone: "error" });
    }
  }, [fetcher.state, fetcher.data, toast, undo]);

  return {
    submit(cmd, opts) {
      toastOverride.current = opts?.toast;
      fetcher.submit(JSON.stringify({ command: cmd }), {
        method: "post",
        action: "/api/command",
        encType: "application/json",
      });
    },
    pending: fetcher.state !== "idle",
  };
}
