import { useMediaQuery } from "./motion";

/** The primary pointer is a finger: focusing a text field would pop the on-screen keyboard. */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

/** Read at the moment of use (e.g. when a sheet opens); false where matchMedia is missing. */
export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/** Reactive form of isCoarsePointer for render output; false on the server and while hydrating. */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}

// Keep in sync with the text-input allow-list in the `(pointer: coarse)` block of app/app.css.
const NON_TEXT_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image", "hidden"]);

/** Controls that bring up the on-screen keyboard (or a picker) when focused. */
export function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}
