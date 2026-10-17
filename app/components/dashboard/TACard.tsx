import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { CountUp } from "~/components/ui/CountUp";
import { Gauge } from "~/components/ui/Gauge";
import { KIND_LABEL, TASK_KINDS, type ISODate, type TA, type TaskKind } from "~/engine/types";
import { fmtDate, plural } from "~/lib/format";

type TACardProps = {
  ta: TA;
  capacity: number;
  used: Record<TaskKind, number>;
  counts: Record<TaskKind, number>;
  totalOccurrences: number;
  nextDates: ISODate[];
  onSwap: () => void;
};

/** One TA's share of the current turn: a liquid gauge of used/capacity, totals and next dates. */
export function TACard({ ta, capacity, used, counts, totalOccurrences, nextDates, onSwap }: TACardProps) {
  return (
    <Card interactive className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta.color }} />
        <h2 className="min-w-0 flex-1 truncate font-display text-heading font-semibold">{ta.name}</h2>
        <span className="shrink-0 rounded-lg bg-ink/5 px-2 py-0.5 text-xs font-semibold text-muted">
          {plural(capacity, "section", "sections")}
        </span>
      </div>

      {/* 220px = two 96px gauges + a 24px gap; narrower containers stack them. */}
      <div className="@container">
        <div className="flex flex-col items-center justify-center gap-4 @[220px]:flex-row @[220px]:gap-6">
          {TASK_KINDS.map((kind) => (
            <div key={kind} className="flex flex-col items-center gap-2">
              <Gauge
                value={capacity ? Math.min(used[kind], capacity) / capacity : 0}
                color={ta.color}
                label={`${ta.name} ${kind}`}
                size={96}
                hideLabel
              />
              <span className={`text-xs font-semibold ${kind === "light" ? "text-light" : "text-heavy"}`}>
                {KIND_LABEL[kind]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Occurrences</dt>
          <dd className="font-semibold">
            <CountUp value={totalOccurrences} />
          </dd>
          <dd className="text-xs text-muted">
            {counts.light} light · {counts.heavy} heavy
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Next</dt>
          <dd className="mt-1 flex min-h-6 flex-wrap gap-2">
            {nextDates.length === 0 ? (
              <span className="text-muted">Nothing upcoming</span>
            ) : (
              nextDates.map((d) => (
                <span key={d} className="rounded-lg bg-ink/5 px-2 py-0.5 text-xs font-medium tabular-nums">
                  {fmtDate(d)}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex justify-end">
        <Button variant="ghost" size="sm" onClick={onSwap} aria-label={`Swap one of ${ta.name}'s dates`}>
          Swap…
        </Button>
      </div>
    </Card>
  );
}
