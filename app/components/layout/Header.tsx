import { Link } from "react-router";
import { BrandMark } from "~/components/ui/BrandMark";
import { IconButton } from "~/components/ui/IconButton";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { useOpenSettings } from "~/lib/settings";
import { useScrolled } from "~/lib/use-scrolled";
import { NavBar } from "./NavBar";

/**
 * Three floating pills — brand, pages (md and up) and actions — that form one cluster: each pill
 * is as wide as its content, 12px apart, and the group as a whole is centred in the viewport (the
 * pages pill is centred as part of the group, not pinned to the viewport centre). Below md the
 * pages live in the bottom tab bar, so the row spreads brand to the start and actions to the end.
 * The header is fixed and --header-h tall (top gap + 48px pills); AppShell's <main> pads by the
 * same variable.
 */
export function Header() {
  const openSettings = useOpenSettings();
  const scrolled = useScrolled();
  const pill = `glass flex h-12 items-center rounded-full transition-shadow duration-300 ${
    scrolled ? "shadow-[var(--shadow-raised)]" : ""
  }`;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 h-(--header-h) pt-3 md:pt-4">
      <div data-header-row className="flex items-center justify-between gap-3 px-4 md:justify-center md:px-6">
        <div data-pill="brand" className={`${pill} pointer-events-auto`}>
          <Link
            to="/"
            className="flex h-full items-center gap-2 rounded-full pl-1.5 pr-4 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BrandMark size={30} className="shrink-0" />
            <span className="whitespace-nowrap font-display text-base font-semibold tracking-tight">TA Load</span>
          </Link>
        </div>
        <NavBar placement="header" className={`${pill} pointer-events-auto`} />
        <div data-pill="actions" className={`${pill} pointer-events-auto gap-0.5 px-0.5`}>
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
