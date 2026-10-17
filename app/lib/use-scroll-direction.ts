import { useEffect, useState } from "react";
import { useHydrated } from "./motion";
import { useAnySheetOpen } from "./sheet-open";

export type ScrollDirection = "up" | "down";

/**
 * Which way the page last scrolled, for hide-on-scroll bars: "down" hides them, "up" shows them.
 * Moves shorter than `threshold` px are ignored (measured from the last accepted position), and
 * the answer is always "up" within `topReveal` px of the top, when the document does not scroll,
 * while a sheet is open (and after it closes, until the next scroll), on the server and while
 * hydrating. Passive listener, read once per animation frame.
 */
export function useScrollDirection({ threshold = 8, topReveal = 24 }: { threshold?: number; topReveal?: number } = {}): ScrollDirection {
  const hydrated = useHydrated();
  const sheetOpen = useAnySheetOpen();
  const [dir, setDir] = useState<ScrollDirection>("up");

  useEffect(() => {
    // A sheet over the page: the bars come back and stay until the user scrolls again.
    if (sheetOpen) {
      setDir("up");
      return;
    }
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const scrollable = document.documentElement.scrollHeight > window.innerHeight;
      if (!scrollable || y < topReveal) {
        lastY = y;
        setDir("up");
        return;
      }
      const delta = y - lastY;
      if (Math.abs(delta) < threshold) return;
      lastY = y;
      setDir(delta > 0 ? "down" : "up");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold, topReveal, sheetOpen]);

  return hydrated && !sheetOpen ? dir : "up";
}
