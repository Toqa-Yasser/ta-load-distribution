import { useEffect, useState } from "react";

/**
 * True once the page is scrolled past `threshold` px. The state starts false and is only set from
 * the effect, so the server and the hydrating render both see false and markup that depends on it
 * hydrates cleanly; a page that loads already scrolled flips on the first effect.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}
