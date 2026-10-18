import { Button } from "~/components/ui/Button";
import { IconButton } from "~/components/ui/IconButton";
import { ChevronDownIcon, ChevronUpIcon } from "~/components/ui/icons";
import type { TA } from "~/engine/types";

type TAOrderListProps = { tas: TA[]; order: string[]; onChange: (order: string[]) => void };

/** The order an equal task goes round the TAs in; rows move up and down one place at a time. */
export function TAOrderList({ tas, order, onChange }: TAOrderListProps) {
  if (tas.length === 0) return <p className="text-sm text-muted">Add TAs on the Team page first.</p>;

  const byId = new Map(tas.map((t) => [t.id, t]));
  const rows = order.flatMap((id) => {
    const ta = byId.get(id);
    return ta ? [ta] : [];
  });
  const teamOrder = tas.map((t) => t.id);
  const isTeamOrder = order.length === teamOrder.length && order.every((id, i) => id === teamOrder[i]);
  const ids = rows.map((t) => t.id);
  const swap = (i: number, j: number) => {
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" className="self-start" disabled={isTeamOrder} onClick={() => onChange(teamOrder)}>
        Team list order
      </Button>
      <ol aria-label="Order" className="flex flex-col divide-y divide-line rounded-field border border-line">
        {rows.map((ta, i) => (
          <li key={ta.id} className="flex min-h-11 items-center gap-3 pl-3">
            <span className="w-6 text-sm tabular-nums text-muted">{i + 1}.</span>
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ta.color }} />
            <span className="min-w-0 flex-1 truncate">{ta.name}</span>
            <IconButton aria-label={`Move ${ta.name} up`} disabled={i === 0} onClick={() => swap(i, i - 1)}>
              <ChevronUpIcon />
            </IconButton>
            <IconButton aria-label={`Move ${ta.name} down`} disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)}>
              <ChevronDownIcon />
            </IconButton>
          </li>
        ))}
      </ol>
    </div>
  );
}
