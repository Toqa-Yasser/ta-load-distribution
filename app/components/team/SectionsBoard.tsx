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
import { INPUT_CLASS } from "~/components/ui/input";
import type { Section, TA } from "~/engine/types";
import { useRetained } from "~/lib/retain";
import { resolveDrop } from "./resolveDrop";
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
  /** A command is in flight: the Add button is disabled so a double submit can't add twice. */
  pending?: boolean;
  /** True when a parent already provides the DndContext (from useSlotDnd); otherwise the board makes its own. */
  withinDnd?: boolean;
};

/** Stable id so dnd-kit's aria-describedby ids match between SSR and hydration. */
export const TEAM_DND_ID = "team-dnd";

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Press Enter to rename this TA. To assign TAs without dragging, activate a section slot to open the slot picker and choose a TA from the list.",
};

/** Sensors and drop handling shared by the board's own DndContext and the Team page's. */
export function useSlotDnd(sections: Section[], onSetSlot: SetSlot) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const target = e.over && resolveDrop(String(e.over.id), String(e.active.id), sections);
    if (target) onSetSlot(target.sectionId, target.slot, target.taId);
  };
  return { sensors, onDragEnd, accessibility: { screenReaderInstructions } };
}

function OwnDnd({ sections, onSetSlot, children }: { sections: Section[]; onSetSlot: SetSlot; children: ReactNode }) {
  const dnd = useSlotDnd(sections, onSetSlot);
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
  pending = false,
  withinDnd = false,
}: SectionsBoardProps) {
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState<{ sectionId: string; slot: 0 | 1 } | null>(null);
  const [removing, setRemoving] = useState<Section | null>(null);
  const taById = useMemo(() => new Map(tas.map((t) => [t.id, t])), [tas]);

  // The picker and confirm keep showing their last target while they animate out.
  const shownPick = useRetained(picking);
  const shownRemoving = useRetained(removing);
  const pickSection = shownPick && sections.find((s) => s.id === shownPick.sectionId);
  const currentTaId = pickSection && shownPick ? pickSection.taIds[shownPick.slot] : null;

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
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Button type="submit" disabled={!draft.trim() || pending}>
          Add
        </Button>
      </form>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        open={picking !== null && pickSection != null}
        title={pickSection && shownPick ? `${pickSection.name} · slot ${shownPick.slot + 1}` : "Pick a TA"}
        tas={tas}
        currentTaId={currentTaId}
        onPick={(taId) => {
          // Picking the TA already in the slot is a no-op: no command, no snapshot, no toast.
          if (picking && taId !== currentTaId) onSetSlot(picking.sectionId, picking.slot, taId);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        title="Remove section?"
        body={shownRemoving ? `"${shownRemoving.name}" will be removed; the TAs in it lose its capacity.` : ""}
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

  return withinDnd ? board : <OwnDnd sections={sections} onSetSlot={onSetSlot}>{board}</OwnDnd>;
}
