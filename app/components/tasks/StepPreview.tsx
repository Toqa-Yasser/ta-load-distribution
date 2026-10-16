import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { Gauge } from "~/components/ui/Gauge";
import { capacities } from "~/engine/capacity";
import type { Workspace } from "~/engine/types";
import { fmtDate, plural } from "~/lib/format";
import { EASE_OUT } from "~/lib/motion";

type StepPreviewProps = {
  /** The workspace as it would be after creating the task (the new task is the last one). */
  preview: Workspace | null;
  taskTitle: string;
  loading: boolean;
  error: string | null;
};

const ROW_STAGGER = 0.03;
const MAX_STAGGER = 0.6;

/** Step 3 of New task: who gets each occurrence, and every TA's load after this task. */
export function StepPreview({ preview, taskTitle, loading, error }: StepPreviewProps) {
  const reduced = useReducedMotion();
  const view = useMemo(() => {
    if (!preview) return null;
    const task = preview.tasks[preview.tasks.length - 1];
    const caps = capacities(preview);
    const taById = new Map(preview.tas.map((t) => [t.id, t]));
    const gauges = preview.tas.map((ta) => {
      const capacity = caps[ta.id] ?? 0;
      const used = preview.ledger.used[ta.id] ?? 0;
      return { ta, capacity, used, value: capacity === 0 ? 0 : used / capacity };
    });
    return { occurrences: task?.occurrences ?? [], taById, gauges };
  }, [preview]);

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-accent-2/30 bg-accent-2/10 p-4 text-sm font-medium text-ink">
        {error}
      </div>
    );
  }

  if (loading || !view) {
    return (
      <div aria-busy="true" aria-label="Loading preview" className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-ink/5 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 md:flex-row">
      <section aria-label="Occurrences" className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="truncate font-semibold">{taskTitle}</h3>
          <p className="shrink-0 text-sm text-muted">{plural(view.occurrences.length, "occurrence", "occurrences")}</p>
        </div>
        <ul className="flex flex-col gap-1">
          {view.occurrences.map((o, i) => {
            const ta = view.taById.get(o.taId);
            return (
              <motion.li
                key={o.id}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT, delay: Math.min(i * ROW_STAGGER, MAX_STAGGER) }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 odd:bg-ink/[0.03]"
              >
                <span className="tabular-nums">{fmtDate(o.date)}</span>
                <span className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-sm">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ta?.color }} />
                  <span className="truncate font-medium">{ta?.name ?? "Unknown TA"}</span>
                </span>
              </motion.li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="preview-after" className="md:w-44 md:shrink-0">
        <h3 id="preview-after" className="mb-3 text-sm font-semibold text-muted">
          After this task
        </h3>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-2">
          {view.gauges.map(({ ta, capacity, used, value }) => (
            <Gauge
              key={ta.id}
              size={64}
              value={value}
              color={ta.color}
              label={capacity === 0 ? `${ta.name} · no slots` : `${ta.name} · ${used}/${capacity}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
