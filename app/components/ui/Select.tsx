import type { ComponentProps } from "react";

/** Styled native <select> with a chevron; 44px tall. Pass <option>s as children. */
export function Select({ className = "", ...rest }: ComponentProps<"select">) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...rest}
        className="min-h-11 w-full cursor-pointer appearance-none rounded-xl border border-line bg-surface py-2 pl-3 pr-10 text-ink transition-colors hover:border-ink/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-accent-2"
      />
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
