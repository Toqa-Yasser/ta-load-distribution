import { DndContext, DragOverlay, type DragStartEvent } from "@dnd-kit/core";
import { useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Route } from "./+types/team";
import { SectionsBoard, TEAM_DND_ID, useSlotDnd } from "~/components/team/SectionsBoard";
import { TAChip } from "~/components/team/TAChip";
import { TAList } from "~/components/team/TAList";
import { EmptyState } from "~/components/ui/EmptyState";
import { turnSize } from "~/engine/capacity";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Team · TA Load Distribution" }];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Team() {
  const { workspace, capacities, taById } = useWorkspace();
  const { submit } = useCommand();
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);

  const occurrenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of workspace.tasks) for (const o of task.occurrences) counts[o.taId] = (counts[o.taId] ?? 0) + 1;
    return counts;
  }, [workspace]);
  const units = useMemo(() => turnSize(workspace), [workspace]);

  const onSetSlot = (sectionId: string, slot: 0 | 1, taId: string | null) =>
    submit({ type: "setSectionSlot", sectionId, slot, taId });
  const dnd = useSlotDnd(onSetSlot);
  const activeTa = activeId ? taById.get(activeId) : undefined;

  return (
    // One DndContext spans both panes: chips live in the TA list, slots in the board.
    <DndContext
      id={TEAM_DND_ID}
      sensors={dnd.sensors}
      accessibility={dnd.accessibility}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={(e) => {
        setActiveId(null);
        dnd.onDragEnd(e);
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-semibold md:text-4xl">Team</h1>
          <p className="mt-1 text-muted">
            {plural(workspace.tas.length, "TA", "TAs")} · {plural(units, "unit", "units")} per turn
          </p>
        </header>

        <div className="grid items-start gap-6 md:grid-cols-[320px_1fr]">
          <section aria-labelledby="team-tas" className="glass flex flex-col gap-2 p-4">
            <h2 id="team-tas" className="text-lg font-semibold">
              TAs
            </h2>
            {workspace.tas.length === 0 && (
              <EmptyState
                icon={<PersonIcon />}
                title="Add your first TA"
                body="Type a name below. Each TA's capacity comes from the section slots they fill."
              />
            )}
            <TAList
              tas={workspace.tas}
              capacities={capacities}
              occurrenceCounts={occurrenceCounts}
              onAdd={(name) => submit({ type: "addTA", name })}
              onRename={(taId, name) => submit({ type: "renameTA", taId, name })}
              onRemove={(taId) => submit({ type: "removeTA", taId })}
            />
          </section>

          <section aria-labelledby="team-sections" className="flex flex-col gap-2">
            <h2 id="team-sections" className="px-1 text-lg font-semibold">
              Sections
            </h2>
            {workspace.sections.length === 0 && (
              <EmptyState
                icon={<GridIcon />}
                title="Create a section and drop two TAs into it"
                body="Every filled slot gives that TA one unit of capacity per turn."
              />
            )}
            <SectionsBoard
              withinDnd
              sections={workspace.sections}
              tas={workspace.tas}
              onAddSection={(name) => submit({ type: "addSection", name })}
              onRename={(sectionId, name) => submit({ type: "renameSection", sectionId, name })}
              onSetSlot={onSetSlot}
              onRemove={(sectionId) => submit({ type: "removeSection", sectionId })}
            />
          </section>
        </div>
      </div>

      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {activeTa && <TAChip ta={activeTa} capacity={capacities[activeTa.id] ?? 0} draggable={false} />}
      </DragOverlay>
    </DndContext>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M12 4v16M3 12h18" />
    </svg>
  );
}
