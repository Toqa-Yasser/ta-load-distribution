import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { BrandMark } from "~/components/ui/BrandMark";
import { IconButton } from "~/components/ui/IconButton";
import { SettingsIcon } from "~/components/ui/icons";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { stagger, useEntranceOnce } from "~/lib/motion";
import { useOpenSettings } from "~/lib/settings";
import { useScrolled } from "~/lib/use-scrolled";
import { NavBar } from "./NavBar";

/**
 * Three floating pills — brand, pages (md and up) and actions — that form one cluster: each pill
 * is as wide as its content, 12px apart, and the group as a whole is centred in the viewport (the
 * pages pill is centred as part of the group, not pinned to the viewport centre). Below md the
 * pages live in the bottom tab bar, so the row spreads brand to the start and actions to the end.
 * The header is fixed and --header-h tall (12px top gap + 44px pills below md, 16px + 48px from
 * md); AppShell's <main> pads by the same variable. On load the pills fade down one after another (stagger, CSS only).
 */
export function Header() {
  const openSettings = useOpenSettings();
  const scrolled = useScrolled();
  const headerRef = useRef<HTMLElement>(null);
  // The brand mark pulses (CSS) until the first client effect: a cue that the page is still loading.
  useEffect(() => {
    headerRef.current?.querySelector(".brand-mark")?.removeAttribute("data-hydrating");
  }, []);
  const pill = `glass flex h-11 items-center md:h-12 rounded-full transition-shadow duration-300 ${
    scrolled ? "shadow-[var(--shadow-raised)]" : ""
  }`;
  // Hidden below md: a plain stagger class would replay the entrance on every md crossing.
  const pagesEntrance = useEntranceOnce<HTMLElement>(1, "down", `${pill} pointer-events-auto`);

  return (
    <header ref={headerRef} className="pointer-events-none fixed inset-x-0 top-0 z-30 h-(--header-h) pt-3 md:pt-4">
      <div data-header-row className="flex items-center justify-between gap-3 px-4 md:justify-center md:px-6">
        <div data-pill="brand" {...stagger(0, "down", `${pill} pointer-events-auto`)}>
          <Link
            to="/"
            className="flex h-full items-center gap-2 rounded-full pl-1.5 pr-4 transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BrandMark size={30} className="shrink-0" />
            <span className="whitespace-nowrap font-display text-base font-semibold tracking-tight">TA Load</span>
          </Link>
        </div>
        <NavBar placement="header" {...pagesEntrance} />
        <div data-pill="actions" {...stagger(2, "down", `${pill} pointer-events-auto gap-0.5 px-0.5`)}>
          <ThemeToggle />
          <IconButton aria-label="Settings" title="Settings" aria-haspopup="dialog" onClick={openSettings}>
            <SettingsIcon />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
