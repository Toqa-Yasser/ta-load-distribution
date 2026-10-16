import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { NavBar } from "./NavBar";

export function Header() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-6">
      <div className="glass mx-auto flex max-w-6xl items-center gap-3 py-1.5 pl-2 pr-1.5">
        <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-xl pr-2 focus-visible:outline-2 focus-visible:outline-accent">
          <span
            aria-hidden
            className="brand-mark grid size-9 place-items-center rounded-xl text-white shadow-[0_6px_20px_-8px_var(--accent)]"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 17V11M10 17V7M15 17v-4M20 17V9" />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Load<span className="text-accent">.</span>
          </span>
        </Link>
        <div className="flex-1" />
        <NavBar placement="header" />
        <div className="flex-1 md:flex-none" />
        <ThemeToggle />
        <Button variant="ghost" icon aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Button>
      </div>
    </header>
  );
}
