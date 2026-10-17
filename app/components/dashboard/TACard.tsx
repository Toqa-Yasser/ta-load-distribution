import { Badge } from "~/components/ui/Badge";
import { Card } from "~/components/ui/Card";
import { CountUp } from "~/components/ui/CountUp";
import { Gauge } from "~/components/ui/Gauge";
import { IconButton } from "~/components/ui/IconButton";
import { SwapIcon } from "~/components/ui/icons";
import { KIND_LABEL, TASK_KINDS, type TA, type TaskKind } from "~/engine/types";
import { fmtDate, plural } from "~/lib/format";
import type { NextDate } from "./stats";

type TACardProps = {
  ta: TA;
  capacity: number;
  used: Record<TaskKind, number>;
  counts: Record<TaskKind, number>;
  totalOccurrences: number;
  nextDates: NextDate[];
  onSwap: () => void;
};

/**
 * One TA's share of the current turn: a liquid gauge of used/capacity per kind, totals and next
 * dates. The TA's colour is the card's only colour; kind captions stay neutral.
 */
export function TACard({ ta, capacity, used, counts, totalOccurrences, nextDates, onSwap }: TACardProps) {
  return (
    <Card interactive className="flex h-full flex-col gap-4 p-5">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta.color }} />
            <h2 className="min-w-0 truncate font-display text-heading font-semibold">{ta.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted">{plural(capacity, "section", "sections")}</p>
        </div>
        {/* -mr/-mt: the 44px target overhangs into the padding so the icon lines up with the name. */}
        <IconButton aria-label={`Swap one of ${ta.name}'s dates`} title="Swap a date" className="-mr-2 -mt-2 text-muted" onClick={onSwap}>
          <SwapIcon />
        </IconButton>
      </header>

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
              <span className="text-xs font-medium text-muted">{KIND_LABEL[kind]}</span>
            </div>
          ))}
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-3 text-sm">
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
              nextDates.map(({ date, titles }) => (
                // Focusable so the tooltip opens from the keyboard too; the inset ring matches form controls.
                <Badge
                  key={date}
                  tone="plain"
                  title={titles.join(", ")}
                  tabIndex={0}
                  className="tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  {fmtDate(date)}
                  <span className="sr-only">: {titles.join(", ")}</span>
                </Badge>
              ))
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
