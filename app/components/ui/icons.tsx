import type { ReactNode, SVGProps } from "react";

/**
 * The app's single icon set: 24×24 line icons drawn at 20px with a 1.75 stroke, in currentColor.
 * Decorative by default (aria-hidden); the control around an icon carries the accessible name.
 * `className` may resize an icon (e.g. `size-7` in an EmptyState); the stroke scales with it.
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function icon(name: string, paths: ReactNode) {
  function Icon({ size = 20, className, ...rest }: IconProps) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${className ?? ""}`}
        {...rest}
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = `${name}Icon`;
  return Icon;
}

export const DashboardIcon = icon("Dashboard", <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z" />);

export const TeamIcon = icon(
  "Team",
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6M16 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4" />
  </>,
);

export const PersonIcon = icon(
  "Person",
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);

export const TasksIcon = icon(
  "Tasks",
  <>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M8.5 12.2l2.3 2.3 4.7-4.9" />
  </>,
);

export const CalendarIcon = icon(
  "Calendar",
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="3.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
);

export const HistoryIcon = icon(
  "History",
  <>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
    <path d="M12 8v4l2.8 1.8" />
  </>,
);

export const SectionsIcon = icon(
  "Sections",
  <>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M12 4v16M3 12h18" />
  </>,
);

export const SettingsIcon = icon(
  "Settings",
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
);

export const PlusIcon = icon("Plus", <path d="M12 5v14M5 12h14" />);
export const CloseIcon = icon("Close", <path d="M6 6l12 12M18 6L6 18" />);
export const ChevronLeftIcon = icon("ChevronLeft", <path d="M15 6l-6 6 6 6" />);
export const ChevronRightIcon = icon("ChevronRight", <path d="M9 6l6 6-6 6" />);
export const ChevronDownIcon = icon("ChevronDown", <path d="M6 9l6 6 6-6" />);
export const TrashIcon = icon("Trash", <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />);
export const SwapIcon = icon("Swap", <path d="M7 4L4 7l3 3M4 7h12a4 4 0 0 1 4 4M17 20l3-3-3-3M20 17H8a4 4 0 0 1-4-4" />);

/** Vertical "more" dots: filled, so they keep their weight at 20px. */
export const KebabIcon = icon(
  "Kebab",
  <g fill="currentColor" stroke="none">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </g>,
);
