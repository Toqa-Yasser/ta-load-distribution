import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, pressMotion } from "~/lib/motion";

/** Rendered by AppShell next to (not inside) the animated page wrapper. */
export const FAB_SLOT_ID = "fab-slot";

type FabProps = { label: string; onClick: () => void; children: ReactNode; className?: string };

/**
 * Floating action button for phones, above the tab bar. It is portalled into #fab-slot because
 * the page wrapper animates a transform, and a transformed ancestor becomes the containing block
 * of `position: fixed` — inside it the button would ride the page slide and then snap into place.
 * The slot is looked up after mount, so the server renders nothing and the button appears once
 * on the client (scaling in; just fading under reduced motion). It fades out while the page exits.
 */
export function Fab({ label, onClick, children, className = "" }: FabProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(FAB_SLOT_ID)), []);
  const reduced = useReducedMotion();
  const press = pressMotion(reduced);
  const present = useIsPresent();

  if (!slot) return null;
  return createPortal(
    <motion.button
      type="button"
      {...press}
      aria-label={label}
      onClick={onClick}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
      animate={present ? { opacity: 1, scale: 1 } : { opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: EASE_OUT }}
      className={`fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-[0_10px_30px_-8px_var(--accent)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden ${className}`}
    >
      {children}
    </motion.button>,
    slot,
  );
}
