import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { taStats } from "~/components/dashboard/stats";
import { SwapSheet } from "~/components/dashboard/SwapSheet";
import { TACard } from "~/components/dashboard/TACard";
import { Timeline } from "~/components/dashboard/Timeline";
import { TurnHeader } from "~/components/dashboard/TurnHeader";
import { EmptyState } from "~/components/ui/EmptyState";
import { TeamIcon } from "~/components/ui/icons";
import { turnSize as computeTurnSize } from "~/engine/capacity";
import { TASK_KINDS, type TaskKind } from "~/engine/types";
import { useRetained } from "~/lib/retain";
import { routeMeta } from "~/lib/seo";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta(matches, { description: "Capacity gauges and upcoming task occurrences for every TA.", path: "/" });
}

const CARD_STAGGER = 0.05;
const MAX_CARD_DELAY = 0.3;
const cardSpring = { type: "spring" as const, stiffness: 320, damping: 26 };

export default function Home() {
  const { workspace, today, capacities, taById } = useWorkspace();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  // The TA id stays set after closing so the sheet can animate out with its content. Holding the
  // id (not the TA object) keeps the sheet's name current after a rename revalidates the data.
  const [swap, setSwap] = useState<{ taId: string; open: boolean } | null>(null);

  const { tas } = workspace;
  const stats = useMemo(() => taStats(workspace, today), [workspace, today]);
  const turnSize = useMemo(() => computeTurnSize(workspace), [workspace]);
  // A TA removed meanwhile (another tab, an undo) closes the sheet for good — adjusted during
  // render, so it can't spring back open if a later undo restores the TA — and the sheet animates
  // out with the last TA it showed (TA objects come from the workspace, so they are stable).
  const swapTa = swap ? taById.get(swap.taId) : undefined;
  if (swap?.open && !swapTa) setSwap({ ...swap, open: false });
  const shownTa = useRetained(swapTa);
  const usedUnits = (kind: TaskKind) => tas.reduce((sum, ta) => sum + (workspace.ledgers[kind].used[ta.id] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-display font-semibold">Dashboard</h1>
        {tas.length > 0 &&
          (turnSize === 0 ? (
            <TurnHeader kind="light" turn={1} usedUnits={0} turnSize={0} />
          ) : (
            // Two equal stat tiles, one per kind (each kind keeps its own turn).
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {TASK_KINDS.map((kind) => (
                <TurnHeader
                  key={kind}
                  kind={kind}
                  turn={workspace.ledgers[kind].turn}
                  usedUnits={usedUnits(kind)}
                  turnSize={turnSize}
                />
              ))}
            </div>
          ))}
      </header>

      {tas.length === 0 ? (
        <EmptyState
          icon={<TeamIcon />}
          title="No TAs yet"
          body="Add your TAs and give them sections on the Team page; their load shows up here."
          action={{ label: "Go to Team", onClick: () => navigate("/team") }}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tas.map((ta, i) => (
              <motion.li
                key={ta.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? { duration: 0 } : { ...cardSpring, delay: Math.min(i * CARD_STAGGER, MAX_CARD_DELAY) }}
              >
                <TACard
                  ta={ta}
                  capacity={capacities[ta.id] ?? 0}
                  used={stats[ta.id]?.used ?? { light: 0, heavy: 0 }}
                  counts={stats[ta.id]?.counts ?? { light: 0, heavy: 0 }}
                  totalOccurrences={stats[ta.id]?.totalOccurrences ?? 0}
                  nextDates={stats[ta.id]?.nextDates ?? []}
                  onSwap={() => setSwap({ taId: ta.id, open: true })}
                />
              </motion.li>
            ))}
          </ul>
          <Timeline tasks={workspace.tasks} taById={taById} today={today} />
        </>
      )}

      {swap && shownTa && <SwapSheet open={swap.open} ta={shownTa} onClose={() => setSwap((s) => s && { ...s, open: false })} />}
    </div>
  );
}

