import { useSyncExternalStore } from "react";

/** Count of open sheets (Sheet holds one while open), so page chrome can react to a modal. */
let openSheets = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Marks one sheet open; the returned release marks it closed again (call it exactly once). */
export function holdSheetOpen(): () => void {
  openSheets += 1;
  notify();
  return () => {
    openSheets -= 1;
    notify();
  };
}

export function openSheetCount(): number {
  return openSheets;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** True while any sheet is open; false on the server and while hydrating. */
export function useAnySheetOpen(): boolean {
  return useSyncExternalStore(subscribe, () => openSheets > 0, () => false);
}
