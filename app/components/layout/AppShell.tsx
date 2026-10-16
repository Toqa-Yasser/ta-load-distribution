import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocation, useOutlet } from "react-router";
import { pageTransition, pageVariants, reducedPageVariants } from "~/lib/motion";
import { Background } from "./Background";
import { Header } from "./Header";
import { NavBar } from "./NavBar";

export function AppShell() {
  const { pathname } = useLocation();
  // Capture the outlet element so the exiting page keeps rendering its own route during the exit animation.
  const outlet = useOutlet();
  const reduced = useReducedMotion();

  return (
    <div className="relative min-h-dvh">
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
          className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pb-12"
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
      <NavBar placement="bottom" />
    </div>
  );
}
