import { DndContext, DragOverlay, type DragStartEvent, type DropAnimation } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { Route } from "./+types/team";
import { applyPendingSlots, usePendingSlotCommands } from "~/components/team/optimistic";
import { resolveDrop } from "~/components/team/resolveDrop";
import { slotId } from "~/components/team/SectionCard";
import { NEW_SECTION_INPUT_ID, SectionsBoard, TEAM_DND_ID, useSlotDnd } from "~/components/team/SectionsBoard";
import { TAChip } from "~/components/team/TAChip";
import { NEW_TA_INPUT_ID, TAList } from "~/components/team/TAList";
import { EmptyState } from "~/components/ui/EmptyState";
import { PersonIcon, SectionsIcon } from "~/components/ui/icons";
import { capacities as computeCapacities, turnSize } from "~/engine/capacity";
import { plural } from "~/lib/format";
import { stagger } from "~/lib/motion";
import { routeMeta } from "~/lib/seo";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta(matches, { title: "Team", description: "Teaching assistants and the sections they teach.", path: "/team" });
}

const LAND_MS = 320;
/** Gentler than EASE_OUT, so the squash into the slot is seen rather than over in a few frames. */
const LAND_EASING = "cubic-bezier(0.33, 1, 0.68, 1)";
/** The capacity badge is gone by this point of the landing; the slot shows no badge. */
const LAND_BADGE_FADE = 0.4;
/** The chip stays opaque until here, then fades out over the identical content in the slot. */
const LAND_FADE_FROM = 0.7;

/** An element's box with any transform scale removed (its offset size, centred on its client rect). */
function restingRect(node: HTMLElement): { left: number; top: number; width: number; height: number } {
  const r = node.getBoundingClientRect();
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  return { left: r.left + (r.width - width) / 2, top: r.top + (r.height - height) / 2, width, height };
}

export default function Team() {
  const { workspace: saved, taById } = useWorkspace();
  const { submit, pending } = useCommand();
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Slot changes still in flight are shown at once; the saved data takes over when it lands.
  const pendingSlots = usePendingSlotCommands();
  const workspace = useMemo(
    () => ({ ...saved, sections: applyPendingSlots(saved.sections, pendingSlots) }),
    [saved, pendingSlots],
  );
  const capacities = useMemo(() => computeCapacities(workspace), [workspace]);

  const occurrenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of workspace.tasks) for (const o of task.occurrences) for (const s of o.seats) counts[s.taId] = (counts[s.taId] ?? 0) + 1;
    return counts;
  }, [workspace]);
  const units = useMemo(() => turnSize(workspace), [workspace]);

  const onSetSlot = (sectionId: string, slot: 0 | 1, taId: string | null) =>
    submit({ type: "setSectionSlot", sectionId, slot, taId });
  const dnd = useSlotDnd(workspace.sections, onSetSlot);
  const activeTa = activeId ? taById.get(activeId) : undefined;

  // The slot a drop just filled: the overlay flies into it (and fades) instead of back to the
  // list. Set on a valid drop, read by the drop animation, cleared when the next drag starts.
  const landing = useRef<string | null>(null);
  const dropAnimation: DropAnimation | null = reduced
    ? null
    : {
        duration: LAND_MS,
        easing: LAND_EASING,
        keyframes: ({ transform, dragOverlay, droppableContainers }) => {
          // The slot's live box (one measured at drag start could be stale after a scroll), at its
          // resting size: at this moment it is still scaled up from the hover, so its client rect is
          // a little larger than where it settles.
          const node = landing.current ? droppableContainers.get(landing.current)?.node.current : null;
          const rect = node && restingRect(node);
          if (!rect) return [{ transform: CSS.Transform.toString(transform.initial) }, { transform: CSS.Transform.toString(transform.final) }];
          // The chip squashes to the slot's exact box: its dot and name share the slot's padding,
          // so when it fades at the end the slot's own content is already in the same place.
          dragOverlay.node.querySelector("[data-badge]")?.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: LAND_MS * LAND_BADGE_FADE,
            easing: LAND_EASING,
            fill: "forwards",
          });
          const { initial } = transform;
          const dx = rect.left - dragOverlay.rect.left;
          const dy = rect.top - dragOverlay.rect.top;
          return [
            { transform: CSS.Transform.toString(initial), width: `${dragOverlay.rect.width}px`, height: `${dragOverlay.rect.height}px`, opacity: 1, offset: 0 },
            { opacity: 1, offset: LAND_FADE_FROM },
            { transform: `translate3d(${initial.x + dx}px, ${initial.y + dy}px, 0)`, width: `${rect.width}px`, height: `${rect.height}px`, opacity: 0, offset: 1 },
          ];
        },
        // The default side effect hides the source chip while the overlay flies back; when the
        // chip lands in a slot the list is not its destination, so the chip stays as it is.
        sideEffects: ({ active }) => {
          if (landing.current) return;
          const { opacity } = active.node.style;
          active.node.style.opacity = "0";
          return () => {
            active.node.style.opacity = opacity;
          };
        },
      };

  return (
    // One DndContext spans both panes: chips live in the TA list, slots in the board.
    <DndContext
      id={TEAM_DND_ID}
      sensors={dnd.sensors}
      accessibility={dnd.accessibility}
      onDragStart={(e: DragStartEvent) => {
        landing.current = null;
        setActiveId(String(e.active.id));
      }}
      onDragEnd={(e) => {
        const target = e.over && resolveDrop(String(e.over.id), String(e.active.id), workspace.sections);
        landing.current = target ? slotId(target.sectionId, target.slot) : null;
        setActiveId(null);
        dnd.onDragEnd(e);
      }}
      onDragCancel={() => {
        landing.current = null;
        setActiveId(null);
      }}
    >
      <div className="flex flex-col gap-6">
        <header {...stagger(0)}>
          <h1 className="text-display font-semibold">Team</h1>
          <p className="mt-1 text-muted">
            {plural(workspace.tas.length, "TA", "TAs")} · {plural(units, "unit", "units")} per turn
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <section aria-labelledby="team-tas" {...stagger(1, "rise", "glass flex flex-col gap-3 p-5")}>
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

          <section aria-labelledby="team-sections" {...stagger(2, "rise", "flex flex-col gap-2")}>
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

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTa && <TAChip ta={activeTa} capacity={capacities[activeTa.id] ?? 0} draggable={false} />}
      </DragOverlay>
    </DndContext>
  );
}

