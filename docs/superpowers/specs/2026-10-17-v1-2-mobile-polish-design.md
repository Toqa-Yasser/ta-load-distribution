# TA Load Distribution v1.2 — Mobile polish, keyboard-safe sheets, loading indicator, minors

## Context

v1.1 shipped (task kinds, three-pill header, metadata, polish). On phones the coordinator reports: the
top pills float above a large gap, sheets autofocus a field so the keyboard pushes the sheet up before
it has been seen, and there is no loading feedback. This round fixes those, tunes phone motion, and
closes every remaining review minor.

User decisions (do not re-ask): the background glow stays exactly as it is on all platforms; the mobile
header keeps **two pills** (tightened, always visible — no slim bar, no hide-on-scroll); entrance
stagger length stays; `backdrop-filter` blur stays on phones.

## 1. Mobile header and tab bar (`< md`)
- Header pills: 44px tall (were ~45–48), aligned to the 16px content gutter, 12px top offset; the gap
  from the header bottom to the page title becomes 16px (currently ~40). `--header-h` updated.
- Bottom tab bar: 56px content height + `env(safe-area-inset-bottom)`; the active tab has a pill
  indicator that **slides** between tabs (`layoutId`, spring; snaps under reduced motion); tabs scale to
  0.94 on press; labels 11px/500.
- Desktop header unchanged.

## 2. Phone motion
- Route changes on `< md` slide **horizontally in tab order** (Dashboard → Team → Tasks → Calendar →
  History): moving right in the order slides the new page in from the right, moving left from the
  left; 180ms, ease-out; task detail enters from the right and leaves to the right. Desktop keeps the
  current fade/rise. Reduced motion: instant swap.
- Bottom sheet: spring tuned for touch (`stiffness 420, damping 38`), rubber-band resistance when
  dragged above its rest position (`dragElastic 0.08`), backdrop opacity follows drag progress,
  velocity-based dismiss threshold unchanged.
- Press feedback (`whileTap` scale 0.96 / 0.98 for large cards) on every tappable: cards that link,
  calendar pills, timeline rows that open things, tab items, chips. Reduced motion: none.
- Stagger timing and blur unchanged.

## 3. Keyboard-safe sheets on touch devices
- **No field autofocus on coarse pointers.** `Sheet` focuses its heading (`tabIndex -1`) when
  `matchMedia("(pointer: coarse)")` matches; `data-autofocus` fields are honoured only on fine
  pointers. The user taps a field when ready; the keyboard never pops on open.
- Viewport: `<meta name="viewport" content="… , interactive-widget=resizes-content">` so the layout
  viewport shrinks when the keyboard opens; sheet max height uses `dvh`; the body scroll container
  scrolls the focused field into view (`scrollIntoView({ block: "nearest" })` on focus).
- **Sticky action footer**: `Sheet` gains a `footer` slot rendered outside the scrolling body
  (border-top, glass), used by NewTaskSheet (Back/Next/Confirm/Cancel), SwapSheet, ConfirmDialog,
  PasswordDialog and SettingsPanel so primary actions stay visible with the keyboard up.
- Desktop behaviour unchanged (autofocus kept).

## 4. Loading indicator
- `TopProgress` (`app/components/layout/TopProgress.tsx`): a 2px accent bar fixed at the top edge,
  shown while `useNavigation().state !== "idle"` or any fetcher is `submitting`/`loading`
  (commands, previews, history actions). Starts at 0, eases to ~80% while pending, completes to 100%
  and fades on idle; appears only if pending lasts > 120ms (no flash on fast actions);
  `role="progressbar" aria-label="Loading"`; reduced motion: static bar, no easing.
- Pre-hydration: a CSS-only pulse on the brand mark (`.brand-mark[data-hydrating]`) removed by the
  first client effect, so a slow first load shows life before React is ready. Desktop and mobile.
- Button `loading` spinners unchanged.

## 5. Minors (all fixed)
- Pages-pill entrance no longer replays when crossing the `md` breakpoint (animate only on first paint).
- Dashboard date chips become focusable (`<button>`-free: `tabIndex=0` span with `title` and the
  sr-only text) so the tooltip is keyboard-reachable.
- Glass sections keep their blur during the opacity entrance (animate a wrapper, not the glass node).
- FAB position pinned by a jsdom test (portal target + fixed classes) in addition to the CDP evidence.
- Engine boundary test scans every engine source (recursive, all import forms).
- `isCurrentWorkspace` validates `tas`/`sections`/`occurrences` element shapes.
- `VERCEL_PROJECT_PRODUCTION_URL` fallback strips an accidental scheme.
- Safari date inputs show the inset focus ring on `:focus` as well as `:focus-visible`.
- Dead-code sweep (unused exports/hooks) via `tsc --noUnusedLocals` locally; remove what it finds.
- `NewTaskSheet` `Wizard` signature wrapped (style).

## 6. Out of scope
Hide-on-scroll header; changes to the glow; stagger/blur tuning; new features.
