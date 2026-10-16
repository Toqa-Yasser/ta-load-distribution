import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { indicatorSpring, usePressMotion } from "~/lib/motion";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const NAV_ITEMS: { to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    icon: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z" {...stroke} />,
  },
  {
    to: "/team",
    label: "Team",
    icon: (
      <g {...stroke}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4" />
      </g>
    ),
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: (
      <g {...stroke}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M8.5 12.2l2.3 2.3 4.7-4.9" />
      </g>
    ),
  },
  {
    to: "/calendar",
    label: "Calendar",
    icon: (
      <g {...stroke}>
        <rect x="3.5" y="5" width="17" height="15" rx="3.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </g>
    ),
  },
  {
    to: "/history",
    label: "History",
    icon: (
      <g {...stroke}>
        <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
        <path d="M12 8v4l2.8 1.8" />
      </g>
    ),
  },
];

/**
 * Primary navigation. `placement="header"` is the inline desktop nav (md and up);
 * `placement="bottom"` is the fixed tab bar shown below md.
 */
export function NavBar({ placement }: { placement: "header" | "bottom" }) {
  const reduced = useReducedMotion();
  const press = usePressMotion();
  const spring = reduced ? { duration: 0 } : indicatorSpring;

  if (placement === "header") {
    return (
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
            {({ isActive }) => (
              <motion.span
                {...press}
                className={`relative isolate flex min-h-11 items-center rounded-xl px-4 text-sm font-medium transition-colors ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator-header"
                    transition={spring}
                    className="absolute inset-0 -z-10 rounded-xl border border-line bg-surface shadow-sm"
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
              className={`relative isolate flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-muted"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-indicator-bottom"
                  transition={spring}
                  className="absolute inset-1 -z-10 rounded-2xl bg-accent/12"
                />
              )}
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                {item.icon}
              </svg>
              {item.label}
            </motion.span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
