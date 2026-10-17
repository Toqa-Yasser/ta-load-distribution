import { useDndContext, useDroppable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { IconButton } from "~/components/ui/IconButton";
import { TrashIcon } from "~/components/ui/icons";
import { Card } from "~/components/ui/Card";
import type { Section, TA } from "~/engine/types";
import { usePressMotion } from "~/lib/motion";
import { InlineRename } from "./InlineRename";

type SectionCardProps = {
  section: Section;
  taById: Map<string, TA>;
  onRename: (name: string) => void;
  onRemove: () => void;
  onSlotTap: (slot: 0 | 1) => void;
};

export const slotId = (sectionId: string, slot: 0 | 1) => `${sectionId}:${slot}`;

function Slot({ section, slot, ta, onTap }: { section: Section; slot: 0 | 1; ta: TA | undefined; onTap: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(section.id, slot) });
  const dragging = useDndContext().active !== null;
  const reduced = useReducedMotion();
  const press = usePressMotion();
  const n = slot + 1;
  const emptyText = dragging ? "Drop here" : "Tap or drop a TA";
  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      {...press}
      animate={{ scale: isOver && !reduced ? 1.04 : 1 }}
      onClick={onTap}
      // The accessible name contains the visible text (WCAG 2.5.3 label in name).
      aria-label={ta ? `Slot ${n} of ${section.name}: ${ta.name}` : `Empty slot ${n} of ${section.name}: ${emptyText}`}
      className={`flex min-h-14 w-full min-w-0 items-center gap-2 rounded-field border px-3 text-left transition-[background-color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isOver
          ? "border-accent bg-accent/10 ring-2 ring-accent"
          : ta
            ? "border-line bg-surface hover:border-ink/25"
            : `border-dashed border-ink/20 text-muted hover:border-accent hover:text-accent-ink ${
                dragging ? "animate-pulse border-accent/60 motion-reduce:animate-none" : ""
              }`
      }`}
    >
      {ta ? (
        <>
          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta.color }} />
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{ta.name}</span>
        </>
      ) : (
        <span className="text-sm">{emptyText}</span>
      )}
    </motion.button>
  );
}

/** One section: an inline-renamable name, two droppable TA slots and a remove action. */
export function SectionCard({ section, taById, onRename, onRemove, onSlotTap }: SectionCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        {editing ? (
          <InlineRename
            value={section.name}
            label={`Rename ${section.name}`}
            onCommit={(name) => {
              setEditing(false);
              onRename(name);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            title="Rename"
            onClick={() => setEditing(true)}
            className="min-h-11 min-w-0 flex-1 truncate rounded-field px-2 text-left font-display text-heading font-semibold transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {section.name}
          </button>
        )}
        <IconButton aria-label={`Remove ${section.name}`} title="Remove section" onClick={onRemove}>
          <TrashIcon />
        </IconButton>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((slot) => {
          const taId = section.taIds[slot];
          return (
            <Slot
              key={slot}
              section={section}
              slot={slot}
              ta={taId === null ? undefined : taById.get(taId)}
              onTap={() => onSlotTap(slot)}
            />
          );
        })}
      </div>
    </Card>
  );
}
