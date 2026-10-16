import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(pref: ThemePref, prefersDark: boolean): "light" | "dark" {
  if (pref === "system") return prefersDark ? "dark" : "light";
  return pref;
}

/**
 * Inlined first in <head> so `data-theme` is set before any CSS paints.
 * Mirrors resolveTheme; must stay dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){var p="system";try{var s=localStorage.getItem("${STORAGE_KEY}");if(s==="light"||s==="dark"||s==="system")p=s;}catch(e){}var d=p==="dark"||(p==="system"&&window.matchMedia&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");})();`;

function readPref(): ThemePref {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "light" || s === "dark" || s === "system") return s;
  } catch {
    // Storage blocked (private mode); fall through.
  }
  return "system";
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
}

function apply(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): { pref: ThemePref; resolved: "light" | "dark"; setPref(p: ThemePref): void } {
  // The server cannot know the preference, so the first client render matches the
  // server ("system"/"light"); the init script has already painted the real theme
  // and this effect only syncs React state to it, without touching the DOM.
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const p = readPref();
    setPrefState(p);
    setResolved(resolveTheme(p, prefersDark()));
  }, []);

  useEffect(() => {
    if (pref !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      apply(next);
      setResolved(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Not persisted, but still applied for this session.
    }
    const next = resolveTheme(p, prefersDark());
    apply(next);
    setPrefState(p);
    setResolved(next);
  }, []);

  return { pref, resolved, setPref };
}
