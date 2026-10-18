import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/Button";
import { IconButton } from "~/components/ui/IconButton";
import { ChevronDownIcon, ChevronUpIcon } from "~/components/ui/icons";
import type { TA } from "~/engine/types";

type TAOrderListProps = { tas: TA[]; order: string[]; onChange: (order: string[]) => void };
type Dir = "up" | "down";

/** The order an equal task goes round the TAs in; rows move up and down one place at a time. */
export function TAOrderList({ tas, order, onChange }: TAOrderListProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const moved = useRef<{ id: string; dir: Dir } | null>(null);

  const byId = new Map(tas.map((t) => [t.id, t]));
  const rows = order.flatMap((id) => {
    const ta = byId.get(id);
    return ta ? [ta] : [];
  });
  const ids = rows.map((t) => t.id);
  const teamOrder = tas.map((t) => t.id);
  const isTeamOrder = ids.length === teamOrder.length && ids.every((id, i) => id === teamOrder[i]);

  // Moving a row re-parents its DOM node (which blurs it), and a row at a bound disables the pressed
  // button; either way focus would drop to <body>. Put it back on the moved TA's button, or its other
  // button once the pressed one is disabled.
  const key = ids.join(" ");
  useEffect(() => {
    const m = moved.current;
    if (!m) return;
    moved.current = null;
    const same = buttons.current.get(`${m.id}:${m.dir}`);
    const other = buttons.current.get(`${m.id}:${m.dir === "up" ? "down" : "up"}`);
    (same && !same.disabled ? same : other)?.focus();
  }, [key]);

  if (tas.length === 0) return <p className="text-sm text-muted">Add TAs on the Team page first.</p>;

  const move = (i: number, dir: Dir) => {
    const j = dir === "up" ? i - 1 : i + 1;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    moved.current = { id: ids[i], dir };
    onChange(next);
  };
  const bind = (id: string, dir: Dir) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(`${id}:${dir}`, el);
    else buttons.current.delete(`${id}:${dir}`);
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
            <IconButton ref={bind(ta.id, "up")} aria-label={`Move ${ta.name} up`} disabled={i === 0} onClick={() => move(i, "up")}>
              <ChevronUpIcon />
            </IconButton>
            <IconButton
              ref={bind(ta.id, "down")}
              aria-label={`Move ${ta.name} down`}
              disabled={i === rows.length - 1}
              onClick={() => move(i, "down")}
            >
              <ChevronDownIcon />
            </IconButton>
          </li>
        ))}
      </ol>
    </div>
  );
}
