/** The scales mark from public/icon.svg; stroke follows the theme via --brand-stroke. Decorative. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" width={size} height={size} className={className ? `brand-mark ${className}` : "brand-mark"} data-hydrating="" fill="none">
      <g stroke="var(--brand-stroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8v18.5M11 26.5h10M5 10.5h22M7 10.5 3.5 18M7 10.5 10.5 18M25 10.5 21.5 18M25 10.5 28.5 18" />
        <path d="M20.5 18h9a4.5 4.5 0 0 1-9 0z" />
      </g>
      <path d="M2.5 18h9a4.5 4.5 0 0 1-9 0z" fill="var(--mint)" stroke="var(--mint)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="6.5" r="2.5" fill="var(--mint)" />
    </svg>
  );
}
