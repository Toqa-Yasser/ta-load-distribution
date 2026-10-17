import { useEffect, useState } from "react";
import { useHydrated } from "./motion";
import { useCoarsePointer } from "./pointer";

/** The visual viewport must lose more than this to count as the keyboard (not a URL bar). */
export const KEYBOARD_MIN_PX = 150;

/**
 * True while the on-screen keyboard is up, on coarse pointers: the visual viewport is more than
 * 150px shorter than the tallest layout viewport seen at the current width. Against the plain
 * `innerHeight` that is iOS (the keyboard only shrinks the visual viewport); the remembered
 * height also covers Android with `interactive-widget=resizes-content`, where the keyboard
 * shrinks `innerHeight` too. The tallest height resets when the width changes (rotation).
 * False without visualViewport, on fine pointers, on the server and while hydrating.
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
    let width = window.innerWidth;
    let tallest = window.innerHeight;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = window.innerHeight;
      }
      tallest = Math.max(tallest, window.innerHeight);
      setOpen(vv.height < tallest - KEYBOARD_MIN_PX);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    vv.addEventListener("resize", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [coarse]);

  return hydrated && coarse && open;
}
