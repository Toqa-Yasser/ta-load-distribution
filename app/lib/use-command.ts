import { useEffect, useRef } from "react";
import { useFetcher, useSubmit } from "react-router";
import { useToast } from "~/components/ui/Toast";
import type { Command } from "~/engine/types";

type CommandResult =
  | { ok: true; version: number; snapshotId: number; label: string }
  | { ok: false; message: string; code?: string };

export function useCommand(): { submit(cmd: Command, opts?: { toast?: string }): void; pending: boolean } {
  const fetcher = useFetcher<CommandResult>();
  const submitForm = useSubmit();
  const toast = useToast();
  const toastOverride = useRef<string | undefined>(undefined);
  const handled = useRef<CommandResult | undefined>(undefined);

  useEffect(() => {
    const data = fetcher.data;
    if (fetcher.state !== "idle" || !data || handled.current === data) return;
    handled.current = data;
    if (data.ok) {
      const { snapshotId } = data;
      toast({
        message: toastOverride.current ?? data.label,
        tone: "success",
        action: {
          label: "Undo",
          // useSubmit (not this hook's fetcher) so Undo still works after the caller unmounts.
          onClick: () =>
            submitForm(
              { intent: "rollback", snapshotId },
              { method: "post", action: "/api/history", encType: "application/json", navigate: false, fetcherKey: "undo" },
            ),
        },
      });
    } else {
      toast({ message: data.message, tone: "error" });
    }
  }, [fetcher.state, fetcher.data, toast, submitForm]);

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
