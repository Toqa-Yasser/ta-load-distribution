import { useCallback, useRef, type RefCallback } from "react";

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus handoff for multi-step sheets. Call `request()` in the handler that changes step and put
 * `ref` on the keyed step container: when the next step mounts, its `[data-autofocus]` element
 * (else its first focusable one, else the enclosing dialog) takes focus. The first step is left
 * alone because Sheet focuses it on open and must record the opener first.
 */
export function useStepFocus(): { ref: RefCallback<HTMLElement>; request: () => void } {
  const pending = useRef(false);
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el || !pending.current) return;
    pending.current = false;
    const target =
      el.querySelector<HTMLElement>("[data-autofocus]") ??
      el.querySelector<HTMLElement>(FOCUSABLE) ??
      el.closest<HTMLElement>('[role="dialog"]');
    target?.focus();
  }, []);
  const request = useCallback(() => {
    pending.current = true;
  }, []);
  return { ref, request };
}
