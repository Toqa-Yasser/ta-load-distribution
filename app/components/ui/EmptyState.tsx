import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/Button";
import { EASE_OUT, useHydrated } from "~/lib/motion";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Heading level for the title, so it follows the page outline (h2 under a page's h1). */
  titleAs?: "h1" | "h2" | "h3";
};

/**
 * Placeholder for empty lists. Server-rendered (and hydrating) markup is shown as-is, fully
 * visible; one that appears later on the client fades and rises in. Under reduced motion
 * MotionConfig makes the rise instant.
 */
export function EmptyState({ icon, title, body, action, titleAs: Title = "h2" }: EmptyStateProps) {
  const animateIn = useHydrated();
  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-8 text-center"
    >
      <motion.div
        aria-hidden
        initial={animateIn ? { scale: 0.8, rotate: -8 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
        className="glass grid size-16 place-items-center text-accent [&_svg]:size-7"
      >
        {icon}
      </motion.div>
      <Title className="font-display text-heading font-semibold">{title}</Title>
      <div className="text-sm text-muted">{body}</div>
      {action && (
        <Button className="mt-1" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
