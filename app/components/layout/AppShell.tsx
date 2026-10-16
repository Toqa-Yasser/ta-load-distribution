import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { APP_ROOT_ID } from "~/components/ui/Sheet";
import { pageTransition, pageVariants, reducedPageVariants } from "~/lib/motion";
import { OpenSettingsContext } from "~/lib/settings";
import { UNDO_FETCHER_KEY, useHistory } from "~/lib/use-history";
import { Background } from "./Background";
import { CommandToasts } from "./CommandToasts";
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
              // pt-21 (84px) = the fixed header's 60px + the old 24px gap below it.
              className="mx-auto max-w-6xl px-4 pb-28 pt-21 md:px-6 md:pb-12"
            >
              {outlet}
            </motion.main>
          </AnimatePresence>
          <NavBar placement="bottom" />
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </CommandToasts>
    </OpenSettingsContext.Provider>
  );
}
