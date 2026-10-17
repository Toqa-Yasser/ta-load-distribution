import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import { NavLink } from "react-router";
import { CalendarIcon, DashboardIcon, HistoryIcon, TasksIcon, TeamIcon } from "~/components/ui/icons";
import { indicatorSpring, pressMotion, tabPress } from "~/lib/motion";
import { useScrollDirection } from "~/lib/use-scroll-direction";
import { BAR_SLIDE, TABBAR_HIDDEN } from "./bars";

const NAV_ITEMS: { to: string; label: string; end?: boolean; Icon: typeof DashboardIcon }[] = [
  { to: "/", label: "Dashboard", end: true, Icon: DashboardIcon },
  { to: "/team", label: "Team", Icon: TeamIcon },
  { to: "/tasks", label: "Tasks", Icon: TasksIcon },
  { to: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { to: "/history", label: "History", Icon: HistoryIcon },
];

/**
 * Primary navigation. `placement="header"` is the centre pill of the desktop header (md and up;
 * `className` carries the shared pill styling, including its `flex`, so below md it is removed
 * with `max-md:hidden` rather than a `hidden`/`md:flex` pair that would fight that `flex`; other
 * nav props, such as the entrance's ref and animation handlers, go to that pill); `placement="bottom"`
 * is the fixed tab bar below md, whose active pill slides between tabs; it slides down out of view
 * while the page scrolls down (see bars.ts).
 */
export function NavBar({ placement, className = "", ...navProps }: { placement: "header" | "bottom" } & Omit<ComponentProps<"nav">, "children">) {
  const reduced = useReducedMotion();
  const press = pressMotion(reduced);
  // Stays defined under reduced motion (empty target): motion adds tabIndex when whileTap is set.
  const tabTap = reduced ? {} : tabPress;
  // Reduced motion: the active indicator snaps instead of sliding.
  const spring = reduced ? { duration: 0 } : indicatorSpring;
  // Called for both placements (hook order); only the tab bar uses it.
  const hidden = useScrollDirection() === "down";

  if (placement === "header") {
    return (
      <nav aria-label="Primary" data-pill="pages" {...navProps} className={`gap-0.5 px-0.5 max-md:hidden ${className}`}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {({ isActive }) => (
              <motion.span
                {...press}
                className={`relative isolate flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  isActive ? "text-ink" : "text-ink/70 hover:text-ink"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator-header"
                    transition={spring}
                    className="absolute inset-0 -z-10 rounded-full border border-line bg-surface shadow-sm"
                  />
                )}
                {item.label}
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      data-tabbar
      data-hidden={hidden || undefined}
      // Exactly --tabbar-h (56px) tall; the safe area raises the whole bar (12px + inset from the
      // edge) instead of padding inside it, so no empty band sits under the labels where a browser
      // reports a gesture-bar inset. Its top is therefore 12px + inset + --tabbar-h from the bottom.
      className={`glass fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex h-(--tabbar-h) justify-around px-1 md:hidden ${BAR_SLIDE} ${
        hidden ? TABBAR_HIDDEN : "translate-y-0"
      }`}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="min-w-0 flex-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-accent">
          {({ isActive }) => (
            <motion.span
              data-press="tab"
              whileTap={tabTap}
              // Sized to its content (flex-auto on the link: content width plus an equal share of
              // the spare room), so a long label ("Dashboard") gets the width it needs. One-line
              // labels; 10px below 360px. px-2: the label stays 4px inside the inset-1 indicator.
              className={`relative isolate flex h-full flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-2xl px-2 text-[11px] font-medium transition-colors max-[22.5rem]:text-[10px] ${
                isActive ? "text-accent-ink" : "text-muted"
              }`}
            >
              {isActive && (
                <motion.span
                  data-tab-indicator
                  layoutId="tab-indicator"
                  transition={spring}
                  // Covers the tab's whole box (icon and label) with 4px breathing room.
                  className="absolute inset-1 -z-10 rounded-xl bg-accent/12"
                />
              )}
              <item.Icon size={24} />
              {item.label}
            </motion.span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
