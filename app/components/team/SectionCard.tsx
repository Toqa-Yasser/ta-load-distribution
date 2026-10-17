import { useDndContext, useDroppable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "~/components/ui/IconButton";
import { TrashIcon } from "~/components/ui/icons";
import { Card } from "~/components/ui/Card";
import type { Section, TA } from "~/engine/types";
import { useMounted, usePressMotion } from "~/lib/motion";
import { InlineRename } from "./InlineRename";

type SectionCardProps = {
  section: Section;
  taById: Map<string, TA>;
  onRename: (name: string) => void;
  onRemove: () => void;
  onSlotTap: (slot: 0 | 1) => void;
};

/** Droppable id of a slot; resolveDrop parses it back. */
export const slotId = (sectionId: string, slot: 0 | 1) => `${sectionId}:${slot}`;

/** The TA a slot shows: its own, or the one hovering over it (as a ghost). */
function TAFace({ ta, ghost }: { ta: TA; ghost?: boolean }) {
  return (
    <>
      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta.color }} />
      <span data-ghost={ghost ? "" : undefined} className={`min-w-0 flex-1 truncate font-medium ${ghost ? "text-ink/50" : "text-ink"}`}>
        {ta.name}
      </span>
    </>
  );
}

type SlotFaceProps = {
  ta: TA | undefined;
  /** The TA being dragged over this slot: shown as a ghost in place of the label, so nothing overlaps. */
  incoming: TA | undefined;
  dragging: boolean;
};

/** A slot's content: its TA, the incoming TA's ghost while one hovers, or the empty-slot label. */
export function SlotFace({ ta, incoming, dragging }: SlotFaceProps) {
  if (incoming && incoming.id !== ta?.id) return <TAFace ta={incoming} ghost />;
  if (ta) return <TAFace ta={ta} />;
  return <span className="text-sm">{dragging ? "Drop here" : "Tap or drop a TA"}</span>;
}

const LAND_FLASH_MS = 450;
const landSpring = { type: "spring", stiffness: 520, damping: 30 } as const;

function Slot({
  section,
  slot,
  ta,
  taById,
  onTap,
}: {
  section: Section;
  slot: 0 | 1;
  ta: TA | undefined;
  taById: Map<string, TA>;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(section.id, slot) });
  const { active } = useDndContext();
  const dragging = active !== null;
  const incoming = isOver && active ? taById.get(String(active.id)) : undefined;
  const reduced = useReducedMotion();
  const press = usePressMotion();
  const mounted = useMounted();
  const n = slot + 1;
  const emptyText = dragging ? "Drop here" : "Tap or drop a TA";

  // A TA landing after mount (a drop, a pick, an undo) pops in and the ring flashes once.
  const [flash, setFlash] = useState(false);
  const lastTa = useRef(ta?.id);
  useEffect(() => {
    if (lastTa.current === ta?.id) return;
    lastTa.current = ta?.id;
    if (!ta || reduced) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), LAND_FLASH_MS);
    return () => clearTimeout(t);
  }, [ta, reduced]);

  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      {...press}
      animate={{ scale: isOver && !reduced ? 1.04 : 1 }}
      onClick={onTap}
      // The accessible name contains the visible text (WCAG 2.5.3 label in name).
      aria-label={ta ? `Slot ${n} of ${section.name}: ${ta.name}` : `Empty slot ${n} of ${section.name}: ${emptyText}`}
      className={`relative flex min-h-14 w-full min-w-0 items-center gap-2 rounded-field border px-3 text-left transition-[background-color,border-color,box-shadow] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isOver
          ? "border-accent bg-accent/10 ring-2 ring-accent"
          : flash
            ? "border-accent bg-surface ring-2 ring-accent/60"
            : ta
              ? "border-line bg-surface hover:border-ink/25"
              : "border-dashed border-ink/20 text-muted hover:border-accent hover:text-accent-ink"
      }`}
    >
      {/* The pulse lives on a textless overlay: Safari starts the animation (a new compositor
          layer) in the same frame the label changes, and a layer holding text keeps painting the
          old label under the new one. */}
      {dragging && !ta && !incoming && (
        <span aria-hidden className="pointer-events-none absolute -inset-px animate-pulse rounded-field border border-dashed border-accent/70 motion-reduce:animate-none" />
      )}
      {/* Keyed by TA so a new one springs in; the first render (and reduced motion) starts at rest. */}
      <motion.span
        key={incoming && incoming.id !== ta?.id ? `ghost:${incoming.id}` : ta?.id ?? "empty"}
        initial={mounted && !reduced ? { scale: 0.85, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : landSpring}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <SlotFace ta={ta} incoming={incoming} dragging={dragging} />
      </motion.span>
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
              taById={taById}
              onTap={() => onSlotTap(slot)}
            />
          );
        })}
      </div>
    </Card>
  );
}
