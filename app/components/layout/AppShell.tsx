import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { FAB_SLOT_ID } from "~/components/ui/Fab";
import { APP_ROOT_ID } from "~/components/ui/Sheet";
import { pageTransition, pageVariants, reducedPageVariants } from "~/lib/motion";
import { OpenSettingsContext } from "~/lib/settings";
import { UNDO_FETCHER_KEY, useHistory } from "~/lib/use-history";
import { Background } from "./Background";
import { CommandToasts } from "./CommandToasts";
import { CONTENT_COLUMN } from "./column";
import { Header } from "./Header";
import { NavBar } from "./NavBar";
import { SettingsPanel } from "./SettingsPanel";

export function AppShell() {
  const { pathname } = useLocation();
  // Capture the outlet element so the exiting page keeps rendering its own route during the exit animation.
  // By then the router has left that route, so its own useLoaderData() is undefined: any route that
  // reads its own loader data must fall back (see EMPTY_HISTORY in routes/history.tsx). Root data is safe.
  const outlet = useOutlet();
  const reduced = useReducedMotion();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  // Toasts the result of every toast's Undo; mounted here so it outlives the page that showed it.
  useHistory(UNDO_FETCHER_KEY);

  return (
    <OpenSettingsContext.Provider value={openSettings}>
      {/* Toasts each command's result, so a toast survives the page that submitted it. */}
      <CommandToasts>
        {/* Made inert while a Sheet is open; sheets portal to <body>, outside it. */}
        <div id={APP_ROOT_ID} className="relative min-h-dvh">
          <Background />
          <Header />
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={pathname}
              variants={reduced ? reducedPageVariants : pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              transition={reduced ? { duration: 0 } : pageTransition}
              // Clears the fixed header (--header-h) plus a 24px gap (32px from md).
              className={`${CONTENT_COLUMN} pb-28 pt-[calc(var(--header-h)+1.5rem)] md:pb-12 md:pt-[calc(var(--header-h)+2rem)]`}
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
