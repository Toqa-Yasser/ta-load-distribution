import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { NavLink } from "react-router";
import { CalendarIcon, DashboardIcon, HistoryIcon, TasksIcon, TeamIcon } from "~/components/ui/icons";
import { indicatorSpring, pressMotion, tabPress } from "~/lib/motion";

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
 * with `max-md:hidden` rather than a `hidden`/`md:flex` pair that would fight that `flex`); `placement="bottom"` is the fixed tab bar below md, whose active pill slides between tabs.
 */
export function NavBar({ placement, className = "", style }: { placement: "header" | "bottom"; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion();
  const press = pressMotion(reduced);
  // Stays defined under reduced motion (empty target): motion adds tabIndex when whileTap is set.
  const tabTap = reduced ? {} : tabPress;
  // Reduced motion: the active indicator snaps instead of sliding.
  const spring = reduced ? { duration: 0 } : indicatorSpring;

  if (placement === "header") {
    return (
      <nav aria-label="Primary" data-pill="pages" style={style} className={`gap-0.5 px-0.5 max-md:hidden ${className}`}>
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
      // --tabbar-h (56px) of tabs; the safe area pads below them (border-box, so the height includes it).
      className="glass fixed inset-x-3 bottom-3 z-40 flex h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] justify-around px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="flex-1 rounded-2xl focus-visible:outline-2 focus-visible:outline-accent">
          {({ isActive }) => (
            <motion.span
              data-press="tab"
              whileTap={tabTap}
              className={`relative isolate flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors ${
                isActive ? "text-accent-ink" : "text-muted"
              }`}
            >
              {isActive && (
                <motion.span
                  data-tab-indicator
                  layoutId="tab-indicator"
                  transition={spring}
                  className="absolute inset-x-1 inset-y-1.5 -z-10 rounded-full bg-accent/12"
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
