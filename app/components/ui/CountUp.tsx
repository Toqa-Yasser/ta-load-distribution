import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { EASE_OUT, useMounted } from "~/lib/motion";

type CountUpProps = { value: number; className?: string };

/**
 * A whole number that counts from its previous value to the new one (~0.6s). The motion value
 * starts at `value`, so the server and the first client render show the final number. Under
 * prefers-reduced-motion (once mounted, so hydration matches SSR) the number is rendered directly.
 * The ticking digits are aria-hidden; screen readers get only the final value (sr-only), not
 * every intermediate number.
 */
export function CountUp({ value, className = "" }: CountUpProps) {
  const reducedMotion = useReducedMotion();
  const reduced = useMounted() && reducedMotion;
  const count = useMotionValue(value);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    if (reduced) {
      count.jump(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.6, ease: EASE_OUT });
    return () => controls.stop();
  }, [count, value, reduced]);

  const cls = `tabular-nums ${className}`;
  return (
    <>
      {reduced ? (
        <span aria-hidden className={cls}>
          {Math.round(value)}
        </span>
      ) : (
        <motion.span aria-hidden className={cls}>
          {rounded}
        </motion.span>
      )}
      <span className="sr-only">{Math.round(value)}</span>
    </>
  );
}
