import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useId } from "react";

type GaugeProps = {
  value: number /* 0..1 */;
  color: string;
  label: string;
  size?: number;
  /** Drop the visible caption (e.g. when a heading nearby already names it); the accessible name stays. */
  hideLabel?: boolean;
};

// SVG user space is 100×100; the vessel is a circle of radius 48 centred at (50, 50).
const WAVE_PERIOD = 100;
const WAVE_AMP = 4;

/** Two periods wide so a translateX of one period loops seamlessly; filled down past the vessel. */
function wavePath(amp: number): string {
  const half = WAVE_PERIOD / 2;
  let d = `M0 0 Q${half / 2} ${-amp} ${half} 0`;
  for (let x = WAVE_PERIOD; x <= WAVE_PERIOD * 2; x += half) d += ` T${x} 0`;
  return `${d} V130 H0 Z`;
}
const FRONT_WAVE = wavePath(WAVE_AMP);
const BACK_WAVE = wavePath(WAVE_AMP * 1.4);

/** Fill fraction → wave baseline y. 0 sits just below the vessel, 1 just above (crests included). */
const levelToY = (v: number) => 106 - v * 112;

/**
 * Circular "liquid" gauge. The surface rises on a spring to `value` and drifts sideways via
 * CSS keyframes (.gauge-wave in app.css, held still under prefers-reduced-motion, where the
 * level also snaps). `value` is clamped to 0..1 (NaN reads as 0) for both the fill and the text.
 */
export function Gauge({ value, color, label, size = 112, hideLabel = false }: GaugeProps) {
  // NaN (e.g. a 0/0 load ratio) reads as empty; everything else, ±Infinity included, is clamped.
  const target = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
  const pct = Math.round(target * 100);
  const reduced = useReducedMotion();
  const clipId = `gauge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Starts empty on both server and client (hydration-safe), then rises once mounted.
  const level = useSpring(0, { stiffness: 70, damping: 16, mass: 1 });
  const y = useTransform(level, levelToY);
  useEffect(() => {
    if (reduced) level.jump(target);
    else level.set(target);
  }, [level, target, reduced]);

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div role="img" aria-label={`${label}: ${pct}% used`} className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="48" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="48" className="fill-ink/5" />
          <g clipPath={`url(#${clipId})`}>
            <motion.g style={{ y }}>
              <path d={BACK_WAVE} fill={color} fillOpacity={0.35} className="gauge-wave gauge-wave-back" />
              <path d={FRONT_WAVE} fill={color} fillOpacity={0.85} className="gauge-wave" />
            </motion.g>
          </g>
          <circle cx="50" cy="50" r="48.5" fill="none" stroke={color} strokeOpacity={0.35} strokeWidth="1.5" />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-xl font-semibold text-ink [text-shadow:0_1px_6px_var(--bg)]">
          {pct}%
        </span>
      </div>
      {!hideLabel && (
        <span aria-hidden className="max-w-full truncate text-sm text-muted">
          {label}
        </span>
      )}
    </div>
  );
}
