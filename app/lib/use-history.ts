import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useSubmit } from "react-router";
import { useToast } from "~/components/ui/Toast";
import { SERVER_ERROR_MESSAGE } from "~/lib/errors";

type HistoryRequest =
  | { intent: "rollback"; snapshotId: number }
  | { intent: "snapshot"; name: string }
  | { intent: "deleteHistory"; password: string };

type HistoryResult =
  | { ok: true; version?: number; snapshotId?: number }
  | { ok: false; message: string; code?: string };

/** Fetcher key shared by every toast's Undo button; AppShell watches it for the result toast. */
export const UNDO_FETCHER_KEY = "undo";

const REQUEST = { method: "post", action: "/api/history", encType: "application/json" } as const;

const SUCCESS: Record<HistoryRequest["intent"], string> = {
  rollback: "Rolled back",
  snapshot: "Snapshot saved",
  deleteHistory: "History deleted",
};

const messageOf = (data: HistoryResult | undefined) =>
  data && data.ok === false && typeof data.message === "string" && data.message ? data.message : SERVER_ERROR_MESSAGE;

/**
 * Undo for a command's toast. Uses useSubmit with a fetcher key (not a component's own
 * fetcher) so it still works after the component that showed the toast unmounts.
 */
export function useUndo(): (snapshotId: number) => void {
  const submit = useSubmit();
  return useCallback(
    (snapshotId: number) =>
      submit({ intent: "rollback", snapshotId } satisfies HistoryRequest, {
        ...REQUEST,
        navigate: false,
        fetcherKey: UNDO_FETCHER_KEY,
      }),
    [submit],
  );
}

/**
 * History actions posted to /api/history, with a toast for every result. A rollback's toast
 * offers Undo (the server snapshots the current state first). `key` shares the fetcher, so
 * AppShell can watch Undo submissions made through useUndo. A failed deleteHistory gets no
 * toast: its promise resolves false and the caller shows `error` inline.
 */
export function useHistory(key?: string): {
  rollback(id: number): void;
  saveSnapshot(name: string): void;
  deleteHistory(password: string): Promise<boolean>;
  pending: boolean;
  error: string | undefined;
} {
  const fetcher = useFetcher<HistoryResult>({ key });
  const toast = useToast();
  const undo = useUndo();
  const intent = useRef<HistoryRequest["intent"] | undefined>(undefined);
  const handled = useRef<HistoryResult | undefined>(undefined);
  const resolveDelete = useRef<((ok: boolean) => void) | undefined>(undefined);

  // Read the intent off the submission itself, so Undo posts made via useUndo are covered too.
  const submitted = (fetcher.json as Partial<HistoryRequest> | undefined)?.intent;
  useEffect(() => {
    if (fetcher.state !== "idle" && submitted) intent.current = submitted;
  }, [fetcher.state, submitted]);

  useEffect(() => {
    const data = fetcher.data;
    if (fetcher.state !== "idle" || data === undefined || handled.current === data) return;
    handled.current = data;
    const ok = data?.ok === true;
    const resolve = resolveDelete.current;
    resolveDelete.current = undefined;
    resolve?.(ok);
    if (ok) {
      const kind = intent.current ?? "rollback";
      const snapshotId = kind === "rollback" ? data.snapshotId : undefined;
      toast({
        message: SUCCESS[kind],
        tone: "success",
        action: snapshotId === undefined ? undefined : { label: "Undo", onClick: () => undo(snapshotId) },
      });
    } else if (!resolve) {
      toast({ message: messageOf(data), tone: "error" });
    }
  }, [fetcher.state, fetcher.data, toast, undo]);

  // Never leave a caller awaiting forever if the hook unmounts mid-request.
  useEffect(() => () => resolveDelete.current?.(false), []);

  const post = (body: HistoryRequest) => fetcher.submit(body, REQUEST);

  return {
    rollback: (snapshotId) => post({ intent: "rollback", snapshotId }),
    saveSnapshot: (name) => post({ intent: "snapshot", name }),
    deleteHistory: (password) =>
      new Promise<boolean>((resolve) => {
        resolveDelete.current?.(false);
        resolveDelete.current = resolve;
        post({ intent: "deleteHistory", password });
      }),
    pending: fetcher.state !== "idle",
    error: fetcher.state === "idle" && fetcher.data?.ok === false ? messageOf(fetcher.data) : undefined,
  };
}
