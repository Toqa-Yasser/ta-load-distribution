import { DndContext, DragOverlay, type DragStartEvent } from "@dnd-kit/core";
import { useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Route } from "./+types/team";
import { NEW_SECTION_INPUT_ID, SectionsBoard, TEAM_DND_ID, useSlotDnd } from "~/components/team/SectionsBoard";
import { TAChip } from "~/components/team/TAChip";
import { NEW_TA_INPUT_ID, TAList } from "~/components/team/TAList";
import { EmptyState } from "~/components/ui/EmptyState";
import { PersonIcon, SectionsIcon } from "~/components/ui/icons";
import { turnSize } from "~/engine/capacity";
import { plural } from "~/lib/format";
import { routeMeta } from "~/lib/seo";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta(matches, { title: "Team", description: "Teaching assistants and the sections they teach.", path: "/team" });
}

export default function Team() {
  const { workspace, capacities, taById } = useWorkspace();
  const { submit, pending } = useCommand();
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
  const dnd = useSlotDnd(workspace.sections, onSetSlot);
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
          <h1 className="text-display font-semibold">Team</h1>
          <p className="mt-1 text-muted">
            {plural(workspace.tas.length, "TA", "TAs")} · {plural(units, "unit", "units")} per turn
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <section aria-labelledby="team-tas" className="glass flex flex-col gap-3 p-5">
            <h2 id="team-tas" className="text-heading font-semibold">
              TAs
            </h2>
            {workspace.tas.length === 0 && (
              <EmptyState
                icon={<PersonIcon />}
                titleAs="h3"
                title="Add your first TA"
                body="Type a name below. Each TA's capacity comes from the section slots they fill."
                action={{ label: "Add a TA", onClick: () => document.getElementById(NEW_TA_INPUT_ID)?.focus() }}
              />
            )}
            <TAList
              tas={workspace.tas}
              capacities={capacities}
              occurrenceCounts={occurrenceCounts}
              onAdd={(name) => submit({ type: "addTA", name })}
              onRename={(taId, name) => submit({ type: "renameTA", taId, name })}
              onRemove={(taId) => submit({ type: "removeTA", taId })}
              pending={pending}
            />
          </section>

          <section aria-labelledby="team-sections" className="flex flex-col gap-2">
            <h2 id="team-sections" className="px-1 text-heading font-semibold">
              Sections
            </h2>
            {workspace.sections.length === 0 && (
              <EmptyState
                icon={<SectionsIcon />}
                titleAs="h3"
                title="Create a section and drop two TAs into it"
                body="Every filled slot gives that TA one unit of capacity per turn."
                action={{ label: "Add a section", onClick: () => document.getElementById(NEW_SECTION_INPUT_ID)?.focus() }}
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
              pending={pending}
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

