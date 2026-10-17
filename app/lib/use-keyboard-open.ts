import { useEffect, useState } from "react";
import { useHydrated } from "./motion";
import { isTextEntry, useCoarsePointer } from "./pointer";

/** The visual viewport must lose more than this to count as the keyboard (not a URL bar). */
export const KEYBOARD_MIN_PX = 150;

/**
 * True while the on-screen keyboard is up, on coarse pointers. All of these must hold: a
 * text-entry element is focused, the page is not pinch-zoomed (visualViewport.scale is 1), and the
 * visual viewport is at least 150px shorter than the baseline. The baseline is the window's
 * `innerHeight`, reset continuously while no field is focused (so split-screen, rotation and URL-bar
 * changes become the new baseline) and frozen while one is. That covers iOS (the keyboard only
 * shrinks the visual viewport) and Android with `interactive-widget=resizes-content` (it shrinks
 * `innerHeight` too). Blur closes it at once. False without visualViewport, on fine pointers, on
 * the server and while hydrating.
 */
export function useKeyboardOpen(): boolean {
  const hydrated = useHydrated();
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!coarse || !vv) {
      setOpen(false);
      return;
    }
    let baseline = window.innerHeight;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!isTextEntry(document.activeElement)) {
        baseline = window.innerHeight;
        setOpen(false);
        return;
      }
      const zoomed = Math.abs(vv.scale - 1) >= 0.01;
      setOpen(!zoomed && vv.height <= baseline - KEYBOARD_MIN_PX);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const now = () => {
      if (frame) cancelAnimationFrame(frame);
      update();
    };
    update();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", now);
    document.addEventListener("focusout", now);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", now);
      document.removeEventListener("focusout", now);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [coarse]);

  return hydrated && coarse && open;
}
