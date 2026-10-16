import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Field } from "~/components/ui/Field";
import type { Section, TA } from "~/engine/types";
import { SectionCard } from "./SectionCard";
import { SlotPicker } from "./SlotPicker";

type SetSlot = (sectionId: string, slot: 0 | 1, taId: string | null) => void;

type SectionsBoardProps = {
  sections: Section[];
  tas: TA[];
  onAddSection: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onSetSlot: SetSlot;
  onRemove: (id: string) => void;
  /** True when a parent already provides the DndContext (from useSlotDnd); otherwise the board makes its own. */
  withinDnd?: boolean;
};

/** Stable id so dnd-kit's aria-describedby ids match between SSR and hydration. */
export const TEAM_DND_ID = "team-dnd";

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable: "Drag onto a section slot to assign this TA, or tap a slot to pick a TA from a list.",
};

/** Sensors and drop handling shared by the board's own DndContext and the Team page's. */
export function useSlotDnd(onSetSlot: SetSlot) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const overId = String(e.over.id);
    const sep = overId.lastIndexOf(":");
    const slot = Number(overId.slice(sep + 1));
    if (sep < 0 || (slot !== 0 && slot !== 1)) return;
    onSetSlot(overId.slice(0, sep), slot, String(e.active.id));
  };
  return { sensors, onDragEnd, accessibility: { screenReaderInstructions } };
}

const INPUT =
  "min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-ink transition-colors hover:border-ink/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function OwnDnd({ onSetSlot, children }: { onSetSlot: SetSlot; children: ReactNode }) {
  const dnd = useSlotDnd(onSetSlot);
  return (
    <DndContext id={TEAM_DND_ID} sensors={dnd.sensors} onDragEnd={dnd.onDragEnd} accessibility={dnd.accessibility}>
      {children}
    </DndContext>
  );
}

export function SectionsBoard({
  sections,
  tas,
  onAddSection,
  onRename,
  onSetSlot,
  onRemove,
  withinDnd = false,
}: SectionsBoardProps) {
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState<{ sectionId: string; slot: 0 | 1 } | null>(null);
  const [removing, setRemoving] = useState<Section | null>(null);
  const taById = useMemo(() => new Map(tas.map((t) => [t.id, t])), [tas]);

  const pickSection = picking && sections.find((s) => s.id === picking.sectionId);
  const currentTaId = pickSection ? pickSection.taIds[picking.slot] : null;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    onAddSection(name);
    setDraft("");
  };

  const board = (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="New section">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Section 1"
              autoComplete="off"
              className={INPUT}
            />
          </Field>
        </div>
        <Button type="submit" disabled={!draft.trim()}>
          Add
        </Button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {sections.map((section) => (
            <motion.li
              key={section.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              <SectionCard
                section={section}
                taById={taById}
                onRename={(name) => onRename(section.id, name)}
                onRemove={() => setRemoving(section)}
                onSlotTap={(slot) => setPicking({ sectionId: section.id, slot })}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <SlotPicker
        open={pickSection != null}
        title={pickSection ? `${pickSection.name} · slot ${picking.slot + 1}` : "Pick a TA"}
        tas={tas}
        currentTaId={currentTaId}
        onPick={(taId) => {
          if (picking) onSetSlot(picking.sectionId, picking.slot, taId);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        title="Remove section?"
        body={removing ? `"${removing.name}" will be removed; the TAs in it lose its capacity.` : ""}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (removing) onRemove(removing.id);
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );

  return withinDnd ? board : <OwnDnd onSetSlot={onSetSlot}>{board}</OwnDnd>;
}
