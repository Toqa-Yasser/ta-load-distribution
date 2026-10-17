import { useMemo } from "react";
import { useFetchers } from "react-router";
import type { Command, Section } from "~/engine/types";
import { isCommandKey } from "~/lib/use-command";

export type SetSlotCommand = Extract<Command, { type: "setSectionSlot" }>;

/**
 * The slot commands still in flight. A command's fetcher stays busy through the server's reply
 * and the root loader's refetch, so overlaying these on the loader data shows a drop the moment
 * it happens and never flashes back before the saved data arrives. A rejected command simply
 * goes idle (its error toasts), and the overlay falls away with it.
 */
export function usePendingSlotCommands(): SetSlotCommand[] {
  const fetchers = useFetchers();
  return useMemo(
    () =>
      fetchers
        .filter((f) => isCommandKey(f.key) && f.state !== "idle")
        .map((f) => (f.json as { command?: Command } | undefined)?.command)
        .filter((c): c is SetSlotCommand => c?.type === "setSectionSlot"),
    [fetchers],
  );
}

/** `sections` with each pending slot command applied in order; the same array when nothing is pending. */
export function applyPendingSlots(sections: Section[], pending: SetSlotCommand[]): Section[] {
  if (pending.length === 0) return sections;
  const byId = new Map(sections.map((s) => [s.id, s]));
  for (const cmd of pending) {
    const s = byId.get(cmd.sectionId);
    if (!s) continue;
    const taIds: Section["taIds"] = [s.taIds[0], s.taIds[1]];
    taIds[cmd.slot] = cmd.taId;
    byId.set(s.id, { ...s, taIds });
  }
  return sections.map((s) => byId.get(s.id) ?? s);
}
