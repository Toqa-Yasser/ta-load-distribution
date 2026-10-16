import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { usePressMotion } from "~/lib/motion";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[0_8px_24px_-10px_var(--accent)] hover:brightness-110 disabled:opacity-50",
  ghost: "text-ink hover:bg-ink/5 disabled:opacity-40",
  danger: "bg-accent-2 text-white hover:brightness-110 disabled:opacity-50",
};

// Both sizes keep the 44px minimum touch target; "sm" only tightens padding and type.
const SIZES: Record<Size, string> = { sm: "px-3 text-sm", md: "px-4" };

export type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  icon?: boolean;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  icon = false,
  loading = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const press = usePressMotion();
  const inert = disabled || loading;
  return (
    <motion.button
      type={type}
      {...(inert ? {} : press)}
      disabled={inert}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${
        icon ? "size-11 p-0" : SIZES[size]
      } ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4 animate-spin motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
