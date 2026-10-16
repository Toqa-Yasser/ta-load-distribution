import { motion, type HTMLMotionProps } from "motion/react";
import { hoverLift, tapPress } from "~/lib/motion";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_8px_24px_-10px_var(--accent)] hover:brightness-110 disabled:opacity-50",
  ghost: "text-ink hover:bg-ink/5 disabled:opacity-40",
  danger: "bg-accent-2 text-white hover:brightness-110 disabled:opacity-50",
};

export type ButtonProps = HTMLMotionProps<"button"> & { variant?: Variant; icon?: boolean };

export function Button({ variant = "primary", icon = false, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={rest.disabled ? undefined : hoverLift}
      whileTap={rest.disabled ? undefined : tapPress}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${
        icon ? "size-11 p-0" : "px-4"
      } ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
