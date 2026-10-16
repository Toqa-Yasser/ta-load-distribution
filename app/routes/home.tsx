import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { SwapSheet } from "~/components/dashboard/SwapSheet";
import { taStats } from "~/components/dashboard/stats";
import { TACard } from "~/components/dashboard/TACard";
import { Timeline } from "~/components/dashboard/Timeline";
import { TurnHeader } from "~/components/dashboard/TurnHeader";
import { EmptyState } from "~/components/ui/EmptyState";
import { turnSize as computeTurnSize } from "~/engine/capacity";
import { TASK_KINDS, type TA, type TaskKind } from "~/engine/types";
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
  // The TA stays set after closing so the sheet can animate out with its content.
  const [swap, setSwap] = useState<{ ta: TA; open: boolean } | null>(null);

  const { tas } = workspace;
  const stats = useMemo(() => taStats(workspace, today), [workspace, today]);
  const turnSize = useMemo(() => computeTurnSize(workspace), [workspace]);
  const usedUnits = (kind: TaskKind) => tas.reduce((sum, ta) => sum + (workspace.ledgers[kind].used[ta.id] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold md:text-4xl">Dashboard</h1>
        {tas.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:gap-8">
            {(turnSize === 0 ? TASK_KINDS.slice(0, 1) : TASK_KINDS).map((kind) => (
              <TurnHeader
                key={kind}
                kind={kind}
                turn={workspace.ledgers[kind].turn}
                usedUnits={usedUnits(kind)}
                turnSize={turnSize}
              />
            ))}
          </div>
        )}
      </header>

      {tas.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon />}
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
                  onSwap={() => setSwap({ ta, open: true })}
                />
              </motion.li>
            ))}
          </ul>
          <Timeline tasks={workspace.tasks} taById={taById} today={today} />
        </>
      )}

      {swap && <SwapSheet open={swap.open} ta={swap.ta} onClose={() => setSwap({ ...swap, open: false })} />}
    </div>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" />
    </svg>
  );
}
