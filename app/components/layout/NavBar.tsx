import { motion, useReducedMotion } from "motion/react";
import { NavLink } from "react-router";
import { CalendarIcon, DashboardIcon, HistoryIcon, TasksIcon, TeamIcon } from "~/components/ui/icons";
import { indicatorSpring, pressMotion } from "~/lib/motion";

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
 * with `max-md:hidden` rather than a `hidden`/`md:flex` pair that would fight that `flex`); `placement="bottom"` is the fixed tab bar below md.
 */
export function NavBar({ placement, className = "" }: { placement: "header" | "bottom"; className?: string }) {
  const reduced = useReducedMotion();
  const press = pressMotion(reduced);
  // Reduced motion: the active indicator snaps instead of sliding.
  const spring = reduced ? { duration: 0 } : indicatorSpring;

  if (placement === "header") {
    return (
      <nav aria-label="Primary" data-pill="pages" className={`gap-0.5 px-0.5 max-md:hidden ${className}`}>
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
      className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="flex-1 rounded-2xl focus-visible:outline-2 focus-visible:outline-accent">
          {({ isActive }) => (
            <motion.span
              whileTap={press.whileTap}
              className={`relative isolate flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium transition-colors ${
                isActive ? "text-accent-ink" : "text-muted"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-indicator-bottom"
                  transition={spring}
                  className="absolute inset-1 -z-10 rounded-2xl bg-accent/12"
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
