import type { Section } from "~/engine/types";

export type SlotTarget = { sectionId: string; slot: 0 | 1; taId: string };

/**
 * Maps a drop on droppable `${sectionId}:${slot}` to a setSectionSlot target. Returns null for
 * malformed ids, unknown sections, and drops onto the TA already in that slot (a no-op that
 * would otherwise write a snapshot and toast).
 */
export function resolveDrop(overId: string, activeId: string, sections: Section[]): SlotTarget | null {
  const sep = overId.lastIndexOf(":");
  if (sep <= 0) return null;
  const slotPart = overId.slice(sep + 1);
  if (slotPart !== "0" && slotPart !== "1") return null;
  const slot = slotPart === "0" ? 0 : 1;
  const sectionId = overId.slice(0, sep);
  const section = sections.find((s) => s.id === sectionId);
  if (!section || section.taIds[slot] === activeId) return null;
  return { sectionId, slot, taId: activeId };
}
