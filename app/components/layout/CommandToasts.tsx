import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher, useFetchers } from "react-router";
import { useToast } from "~/lib/toast";
import { CommandWatchContext, commandToast, isCommandKey, type CommandResult } from "~/lib/use-command";
import { useUndo } from "~/lib/use-history";

/**
 * Shows exactly one toast per command result. Commands are found two ways: useCommand announces
 * each key through CommandWatchContext, and any in-flight `cmd:` fetcher seen in useFetchers() is
 * picked up too. Each key gets a <CommandWatcher> that reads its result and then unmounts, which
 * lets the router drop the finished fetcher.
 */
export function CommandToasts({ children }: { children: ReactNode }) {
  // key -> toast override (undefined: the server's label)
  const [watched, setWatched] = useState<ReadonlyMap<string, string | undefined>>(new Map());
  // Keys already toasted. A key leaves the set once its fetcher is gone from the router too.
  const handled = useRef(new Set<string>());
  const fetchers = useFetchers();

  const watch = useCallback((key: string, toast?: string) => {
    if (handled.current.has(key)) return;
    setWatched((m) => (m.has(key) ? m : new Map(m).set(key, toast)));
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
      {[...watched].map(([key, toast]) => (
        <CommandWatcher key={key} fetcherKey={key} toast={toast} onDone={done} />
      ))}
    </CommandWatchContext.Provider>
  );
}

function CommandWatcher({ fetcherKey, toast: override, onDone }: { fetcherKey: string; toast?: string; onDone(key: string): void }) {
  const fetcher = useFetcher<CommandResult>({ key: fetcherKey });
  const toast = useToast();
  const undo = useUndo();
  const fired = useRef(false);
  const busy = useRef(false);
  if (fetcher.state !== "idle") busy.current = true;

  useEffect(() => {
    if (fired.current || fetcher.state !== "idle") return;
    // Idle with no data before the request started: still waiting for the submission.
    if (fetcher.data === undefined && !busy.current) return;
    fired.current = true;
    toast(commandToast(fetcher.data, undo, override));
    onDone(fetcherKey);
  }, [fetcher.state, fetcher.data, fetcherKey, override, toast, undo, onDone]);

  return null;
}
