import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "plain" | "accent" | "light" | "heavy" | "danger";

/** `tabIndex={0}` makes a badge with a `title` focusable, so its tooltip is keyboard-reachable; it stays a span, not a control. */
type BadgeProps = { tone?: BadgeTone; size?: "sm" | "md"; title?: string; tabIndex?: number; className?: string; children: ReactNode };

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-muted",
  plain: "bg-ink/[0.06] text-ink",
  accent: "bg-accent/15 text-accent-ink",
  light: "bg-light/15 text-light",
  heavy: "bg-heavy/15 text-heavy",
  danger: "bg-danger/12 text-danger-ink",
};

const SIZE = { sm: "h-5 gap-1 px-2 text-xs", md: "h-6 gap-1 px-3 text-xs" } as const;

/** Small static pill label (not interactive): kinds, counts, dates, owners, "Today". */
export function Badge({ tone = "neutral", size = "md", title, tabIndex, className = "", children }: BadgeProps) {
  return (
    <span
      data-badge
      title={title}
      tabIndex={tabIndex}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold leading-none ${TONE[tone]} ${SIZE[size]} ${className}`}
    >
      {children}
    </span>
  );
}
