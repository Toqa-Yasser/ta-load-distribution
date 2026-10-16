import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher, useFetchers } from "react-router";
import { useToast } from "~/lib/toast";
import {
  COMMAND_STALL_MS,
  CommandWatchContext,
  commandToast,
  isCommandKey,
  settledResult,
  type SubmitOptions,
} from "~/lib/use-command";
import { useUndo } from "~/lib/use-history";

/**
 * Shows exactly one toast per command result. Commands are found two ways: useCommand announces
 * each key through CommandWatchContext, and any in-flight `cmd:` fetcher seen in useFetchers() is
 * picked up too. Each key gets a <CommandWatcher> that reads its result and then unmounts, which
 * lets the router drop the finished fetcher.
 */
export function CommandToasts({ children }: { children: ReactNode }) {
  // key -> the submitter's options (undefined for keys discovered through useFetchers)
  const [watched, setWatched] = useState<ReadonlyMap<string, SubmitOptions | undefined>>(new Map());
  // Keys already toasted. A key leaves the set once its fetcher is gone from the router too.
  const handled = useRef(new Set<string>());
  const fetchers = useFetchers();

  const watch = useCallback((key: string, opts?: SubmitOptions) => {
    if (handled.current.has(key)) return;
    setWatched((m) => (m.has(key) && (m.get(key) || !opts) ? m : new Map(m).set(key, opts)));
  }, []);

  useEffect(() => {
    const live = new Set(fetchers.map((f) => f.key));
    for (const f of fetchers) if (isCommandKey(f.key) && f.state !== "idle") watch(f.key);
    for (const key of handled.current) if (!live.has(key)) handled.current.delete(key);
  }, [fetchers, watch]);

  const done = useCallback((key: string) => {
    handled.current.add(key);
    setWatched((m) => {
      const next = new Map(m);
      next.delete(key);
      return next;
    });
  }, []);

  return (
    <CommandWatchContext.Provider value={watch}>
      {children}
      {[...watched].map(([key, opts]) => (
        <CommandWatcher key={key} fetcherKey={key} opts={opts} onDone={done} />
      ))}
    </CommandWatchContext.Provider>
  );
}

function CommandWatcher({ fetcherKey, opts, onDone }: { fetcherKey: string; opts?: SubmitOptions; onDone(key: string): void }) {
  const fetcher = useFetcher({ key: fetcherKey });
  const toast = useToast();
  const undo = useUndo();
  const fired = useRef(false);
  const busy = useRef(false);
  if (fetcher.state !== "idle") busy.current = true;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const settle = useCallback(
    (data: unknown) => {
      if (fired.current) return;
      fired.current = true;
      const result = settledResult(data);
      const inline = optsRef.current?.inlineError;
      if (result.ok || !(typeof inline === "function" ? inline() : inline)) toast(commandToast(result, undo));
      optsRef.current?.onSettled?.(result);
      onDone(fetcherKey);
    },
    [fetcherKey, toast, undo, onDone],
  );

  // Idle with no data and never seen busy: normally the submission hasn't started yet, but a
  // fetcher that finished (or was dropped) before this watcher mounted looks the same. Give it
  // COMMAND_STALL_MS to start before settling it as a failure, so the submitter never hangs.
  const waiting = fetcher.state === "idle" && fetcher.data === undefined && !busy.current;
  useEffect(() => {
    if (fired.current) return;
    if (waiting) {
      const t = setTimeout(() => settle(undefined), COMMAND_STALL_MS);
      return () => clearTimeout(t);
    }
    if (fetcher.state === "idle") settle(fetcher.data);
  }, [waiting, fetcher.state, fetcher.data, settle]);

  return null;
}
