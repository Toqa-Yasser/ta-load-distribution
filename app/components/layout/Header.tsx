import { Link } from "react-router";
import { BrandMark } from "~/components/ui/BrandMark";
import { IconButton } from "~/components/ui/IconButton";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { useOpenSettings } from "~/lib/settings";
import { useScrolled } from "~/lib/use-scrolled";
import { CONTENT_COLUMN } from "./column";
import { NavBar } from "./NavBar";

/**
 * Three independent floating pills: brand (start), pages (centre, md and up) and actions (end) in
 * a 1fr/auto/1fr grid that sits in the same column as the page content (HEADER_COLUMN mirrors
 * AppShell's <main> max-width and padding), so the brand pill lines up with the page title and the
 * actions pill with the content's right edge; the centre pill stays centred whatever the outer
 * pills' widths. Below md the centre column is empty (the pages live in the bottom tab bar).
 * The header is fixed and --header-h tall (12px top gap + 48px pills); AppShell's <main> pads by
 * the same variable.
 */
export function Header() {
  const openSettings = useOpenSettings();
  const scrolled = useScrolled();
  const pill = `glass flex h-12 items-center rounded-full transition-shadow duration-300 ${
    scrolled ? "shadow-[var(--shadow-raised)]" : ""
  }`;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 h-(--header-h) pt-3">
      <div data-header-column className={`${CONTENT_COLUMN} grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3`}>
        <div data-pill="brand" className={`${pill} pointer-events-auto justify-self-start pl-1.5 pr-4`}>
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2 rounded-full pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BrandMark size={30} className="shrink-0" />
            <span className="whitespace-nowrap font-display text-base font-semibold tracking-tight">TA Load</span>
          </Link>
        </div>
        <NavBar placement="header" className={`${pill} pointer-events-auto justify-self-center`} />
        <div data-pill="actions" className={`${pill} pointer-events-auto col-start-3 justify-self-end gap-0.5 px-0.5`}>
          <ThemeToggle />
          <IconButton aria-label="Settings" title="Settings" aria-haspopup="dialog" onClick={openSettings}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </IconButton>
        </div>
      </div>
    </header>
  );
}
