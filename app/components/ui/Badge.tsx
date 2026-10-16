import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "light" | "heavy" | "danger";

type BadgeProps = { tone?: BadgeTone; size?: "sm" | "md"; children: ReactNode };

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-muted",
  accent: "bg-accent/15 text-accent-ink",
  light: "bg-light/15 text-light",
  heavy: "bg-heavy/15 text-heavy",
  danger: "bg-danger/12 text-danger-ink",
};

const SIZE = { sm: "h-5 px-2 text-[12px]", md: "h-6 px-2.5 text-[13px]" } as const;

/** Small static pill label (not interactive). */
export function Badge({ tone = "neutral", size = "md", children }: BadgeProps) {
  return (
    <span
      data-badge
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold leading-none ${TONE[tone]} ${SIZE[size]}`}
    >
      {children}
    </span>
  );
}
