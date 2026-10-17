# v1.2 — Mobile polish, keyboard-safe sheets, loading indicator, minors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the phone experience feel finished — tighter header/tab bar, native-feeling motion, sheets that never get shoved off-screen by the keyboard — add a global loading indicator on all screens, and close every remaining review minor.

**Architecture:** UI-only round on the existing structure: `Sheet` gains a footer slot and coarse-pointer focus policy; `AppShell` gains `TopProgress` and direction-aware page variants; `NavBar`/`Header` get mobile sizing and the sliding tab indicator. No engine or server changes except the minors (`isCurrentWorkspace`, env fallback).

**Tech Stack:** unchanged. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-17-v1-2-mobile-polish-design.md`

## Global Constraints

- The background glow, stagger timing and `backdrop-filter` blur are NOT changed (user decisions).
- Mobile header keeps two pills, always visible.
- ≥44px targets; every animation disabled under reduced motion; `useHydrated`/`useMounted` for markup-changing branches; hydration-safe; tokens only; mutations via `useCommand`.
- No AI-attribution trailers or tool mentions in commits or files.
- `npm test`, `npm run typecheck`, `npm run build` green before every commit; mobile checks via CDP device emulation (never `--window-size=375`); Safari checks via safaridriver where Safari-specific.

## Review Focus

1. Opening any sheet on a touch device must not open the keyboard (Task 3 test: coarse pointer → heading focused, no input focused).
2. With the keyboard open, the sheet's primary actions must remain visible and the focused field reachable (Task 3 CDP check with a 300px-shorter viewport).
3. Horizontal page slides must pick the right direction for every pair of tabs and for task detail (Task 2 unit test on the direction function).
4. The progress bar must never stick: every pending state ends in a completion (Task 4 tests incl. an errored fetcher).
5. Tab-bar indicator and header changes must not regress 375px overflow or the 44px rule (Task 1 CDP + class tests).

---

### Task 1: Mobile header + tab bar
**Files:** `app/components/layout/{Header,NavBar}.tsx`, `app/app.css` (`--header-h` mobile), tests.
- [ ] Failing tests: `mobile header pills are 44px and the main offset is header + 16px`; `active tab renders the sliding indicator with aria-current`; `tab items have press feedback props`.
- [ ] Implement per spec §1; CDP 375 check: no overflow, title at header bottom + 16px; commit `style(nav): tighter mobile header; sliding tab indicator`.

### Task 2: Phone motion — directional page slides, sheet physics, press feedback
**Files:** `app/lib/motion.ts` (`slideDirection(from, to)`, `pageVariantsFor(dir)`, touch spring presets), `app/components/layout/AppShell.tsx`, `app/components/ui/Sheet.tsx` (drag physics, backdrop tied to drag), cards/pills/rows/chips (press), tests.
- [ ] Failing tests: `slideDirection` table (every ordered pair + task detail); `AppShell uses horizontal variants below md and fade above`; `Sheet backdrop opacity follows drag progress`.
- [ ] Implement per spec §2; headless check of a navigation on 375 (slide direction) and reduced motion (instant); commit `feat(motion): directional page slides on phones; touch sheet physics; press feedback`.

### Task 3: Keyboard-safe sheets
**Files:** `app/components/ui/Sheet.tsx` (coarse-pointer focus policy, `footer` slot, dvh height, scroll-into-view), `app/root.tsx` (viewport meta), `NewTaskSheet`, `SwapSheet`, `ConfirmDialog`, `PasswordDialog`, `SettingsPanel` (move actions into `footer`), tests.
- [ ] Failing tests: `on a coarse pointer the sheet focuses its heading and no input` (mock matchMedia); `on a fine pointer data-autofocus is honoured`; `footer renders outside the scroll body`; `viewport meta includes interactive-widget=resizes-content`.
- [ ] Implement per spec §3; CDP check: 375×812 emulation with `visualViewport`/viewport shrunk by 300px → footer visible, focused field scrolled into view; commit `feat(sheet): keyboard-safe sheets on touch devices; sticky action footer`.

### Task 4: Loading indicator
**Files:** Create `app/components/layout/TopProgress.tsx`, `app/lib/use-pending.ts` (`usePendingGlobal(): boolean` from navigation + fetchers), CSS for the pre-hydration pulse; `AppShell`, `BrandMark`/`Header`; tests.
- [ ] Failing tests: `progress bar shows after 120ms of pending and completes on idle`; `an errored fetcher still completes the bar`; `reduced motion renders a static bar`; `brand mark drops data-hydrating after mount`.
- [ ] Implement per spec §4; headless check on a slow action (throttled via a 1s stub) desktop + 375; commit `feat(shell): top progress bar for navigations and pending commands`.

### Task 5: Minors batch
**Files:** per spec §5 (`NavBar` first-paint entrance, `TACard` date chips, glass entrance wrappers, `Fab` test, `boundaries.test.ts`, `migrate.ts` `isCurrentWorkspace`, `env.server.ts`, `input.ts`/date inputs, dead-code sweep, `NewTaskSheet` formatting).
- [ ] Each item with a failing-first test where logic; commit per area.

### Task 6: Verification & release
- [ ] Gate green; CDP 375 pass of all pages + sheets (light/dark); Safari pass (navigation, a sheet with the footer, date input focus ring); Lighthouse a11y 100 `/` and `/tasks`; merge to `main`, push (Vercel deploys); verify the live URL incl. the progress bar and keyboard behaviour notes for the user to confirm on a real phone.
