import { useEffect, useState } from "react";
import { useMounted } from "~/lib/motion";

/**
 * True once the page is scrolled past `threshold` px. Always false on the server and the first
 * client render (gated by useMounted), so markup that depends on it hydrates cleanly.
 */
export function useScrolled(threshold = 8): boolean {
  const mounted = useMounted();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return mounted && scrolled;
}
