import { useDndContext, useDroppable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
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
  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      {...press}
      animate={{ scale: isOver && !reduced ? 1.04 : 1 }}
      onClick={onTap}
      aria-label={ta ? `Slot ${n} of ${section.name}: ${ta.name}` : `Empty slot ${n} of ${section.name}`}
      className={`flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left transition-[background-color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isOver
          ? "border-accent bg-accent/10 ring-2 ring-accent"
          : ta
            ? "border-line bg-surface hover:border-ink/25"
            : `border-dashed border-ink/20 text-muted hover:border-accent hover:text-accent ${
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
        <span className="text-sm">{dragging ? "Drop here" : "Tap or drop a TA"}</span>
      )}
    </motion.button>
  );
}

/** One section: an inline-renamable name, two droppable TA slots and a remove action. */
export function SectionCard({ section, taById, onRename, onRemove, onSlotTap }: SectionCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-4">
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
            className="min-h-11 min-w-0 flex-1 truncate rounded-xl px-2 text-left font-display text-lg font-semibold transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {section.name}
          </button>
        )}
        <Button variant="ghost" icon aria-label={`Remove ${section.name}`} title="Remove section" onClick={onRemove}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </Button>
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
