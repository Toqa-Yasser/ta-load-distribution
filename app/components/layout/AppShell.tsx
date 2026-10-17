import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { FAB_SLOT_ID } from "~/components/ui/Fab";
import { APP_ROOT_ID } from "~/components/ui/Sheet";
import {
  PHONE_QUERY,
  pageTransition,
  phonePageTransition,
  reducedPageVariants,
  routeVariants,
  slideDirection,
  useMediaQuery,
} from "~/lib/motion";
import { OpenSettingsContext } from "~/lib/settings";
import { UNDO_FETCHER_KEY, useHistory } from "~/lib/use-history";
import { usePendingGlobal } from "~/lib/use-pending";
import { Background } from "./Background";
import { CommandToasts } from "./CommandToasts";
import { CONTENT_COLUMN } from "./column";
import { Header } from "./Header";
import { NavBar } from "./NavBar";
import { SettingsPanel } from "./SettingsPanel";
import { TopProgress } from "./TopProgress";

export function AppShell() {
  const { pathname } = useLocation();
  // Capture the outlet element so the exiting page keeps rendering its own route during the exit animation.
  // By then the router has left that route, so its own useLoaderData() is undefined: any route that
  // reads its own loader data must fall back (see EMPTY_HISTORY in routes/history.tsx). Root data is safe.
  const outlet = useOutlet();
  const reduced = useReducedMotion();
  // False on the server and while hydrating, so the first paint matches; the first client
  // navigation already sees the real value.
  const isPhone = useMediaQuery(PHONE_QUERY);
  // Direction of the latest route change along the tab order (see slideDirection). Derived
  // during render from the previous pathname, so the entering and exiting pages share it.
  const [route, setRoute] = useState({ pathname, dir: 0 });
  if (route.pathname !== pathname) setRoute({ pathname, dir: slideDirection(route.pathname, pathname) });
  const dir = route.dir;
  const variants = useMemo(() => (reduced ? reducedPageVariants : routeVariants(isPhone)), [reduced, isPhone]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  // Toasts the result of every toast's Undo; mounted here so it outlives the page that showed it.
  useHistory(UNDO_FETCHER_KEY);
  // Pairs with TopProgress (an indeterminate bar): assistive tech hears the page is updating.
  const pending = usePendingGlobal();

  return (
    <OpenSettingsContext.Provider value={openSettings}>
      {/* Toasts each command's result, so a toast survives the page that submitted it. */}
      <CommandToasts>
        {/* Made inert while a Sheet is open; sheets portal to <body>, outside it. */}
        <div id={APP_ROOT_ID} className="relative min-h-dvh overflow-x-clip">
          <Background />
          <TopProgress />
          <Header />
          {/* `custom` reaches the exiting page too, so it leaves in the new direction. */}
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.main
              key={pathname}
              custom={dir}
              aria-busy={pending || undefined}
              variants={variants}
              initial="initial"
              animate="enter"
              exit="exit"
              transition={reduced ? { duration: 0 } : isPhone ? phonePageTransition : pageTransition}
              // Clears the fixed header (--header-h) plus a 16px gap (32px from md), and below md the
              // floating tab bar (12px offset + --tabbar-h + safe area) plus 16px.
              className={`${CONTENT_COLUMN} pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.75rem)] pt-[calc(var(--header-h)+1rem)] md:pb-12 md:pt-[calc(var(--header-h)+2rem)]`}
            >
              {outlet}
            </motion.main>
          </AnimatePresence>
          {/* Fixed page overlays (Fab) portal here: inside the animated <main> a transform would
              become their containing block and they would ride the page transition. */}
          <div id={FAB_SLOT_ID} />
          <NavBar placement="bottom" />
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </CommandToasts>
    </OpenSettingsContext.Provider>
  );
}
