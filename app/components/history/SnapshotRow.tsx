import { format, formatDistanceToNow, parseISO } from "date-fns";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "~/components/ui/Button";
import { EASE_OUT, useMounted } from "~/lib/motion";
import type { SnapshotMeta } from "~/server/store";

type SnapshotRowProps = { snapshot: SnapshotMeta; latest: boolean; onRollback: () => void };

/**
 * One history entry. The relative time ("5 minutes ago") is client-only: SSR and the first
 * client render show the absolute time, which may differ by timezone, hence
 * suppressHydrationWarning on that text alone.
 */
export function SnapshotRow({ snapshot, latest, onRollback }: SnapshotRowProps) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const created = parseISO(snapshot.createdAt);
  const absolute = format(created, "EEE, MMM d yyyy, HH:mm");

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.25, ease: EASE_OUT }}
      className="glass flex flex-wrap items-center gap-3 py-2 pl-4 pr-2"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* An auto snapshot holds the state from just before its labelled change. */}
          <span className="min-w-0 font-medium wrap-anywhere">
            {snapshot.kind === "auto" && <span className="text-muted">Before: </span>}
            {snapshot.label}
          </span>
          {snapshot.kind === "manual" && snapshot.name && (
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-semibold text-accent">
              <span className="sr-only">Manual snapshot: </span>
              {snapshot.name}
            </span>
          )}
          {latest && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">Latest change</span>
          )}
        </div>
        <time dateTime={snapshot.createdAt} title={absolute} className="text-sm text-muted" suppressHydrationWarning>
          {mounted ? formatDistanceToNow(created, { addSuffix: true }) : absolute}
        </time>
      </div>
      <Button variant="ghost" size="sm" onClick={onRollback}>
        Roll back
      </Button>
    </motion.li>
  );
}
