import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";

type CardProps = { children: ReactNode; className?: string; interactive?: boolean };

const TILT_DEG = 6;
const tiltSpring = { stiffness: 260, damping: 24, mass: 0.6 };

/**
 * Glass surface. `interactive` tilts the card toward a mouse/pen pointer (±6°) with a soft
 * specular highlight, springing flat on leave. Touch and prefers-reduced-motion get no tilt.
 * Render output never depends on the reduced-motion flag, so SSR and hydration agree.
 */
export function Card({ children, className = "", interactive = false }: CardProps) {
  const reduced = useReducedMotion();
  // Pointer position within the card, -0.5..0.5 on each axis (0 = centre).
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, tiltSpring);
  const sy = useSpring(py, tiltSpring);
  const rotateX = useTransform(sy, [-0.5, 0.5], [TILT_DEG, -TILT_DEG]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-TILT_DEG, TILT_DEG]);
  const glareX = useTransform(sx, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(sy, [-0.5, 0.5], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, var(--glare), transparent 60%)`;
  const glareOpacity = useSpring(0, tiltSpring);

  if (!interactive) return <div className={`glass ${className}`}>{children}</div>;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
    glareOpacity.set(1);
  };
  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
    glareOpacity.set(0);
  };

  return (
    <motion.div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={`glass relative will-change-transform ${className}`}
    >
      {children}
      <motion.div
        aria-hidden
        style={{ background: glare, opacity: glareOpacity }}
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
      />
    </motion.div>
  );
}
