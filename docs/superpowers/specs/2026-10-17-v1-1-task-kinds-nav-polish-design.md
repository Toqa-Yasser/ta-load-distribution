# TA Load Distribution v1.1 — Task kinds, navigation, metadata, polish

## Context

v1.0 shipped (public repo `Toqa-Yasser/ta-load-distribution`, 117 tests). The coordinator now wants:
tasks split into two independent fairness systems (light vs heavy), a three-pill navigation bar, full
site metadata with a proper icon, every deferred review minor fixed, and a visual/motion polish pass.
The live database has 2 TAs, 1 section and 0 tasks, so the data-model change needs only a safe upgrade
path, not a data migration.

User decisions (do not re-ask): capacity stays = section slots for both kinds, with **two independent
turn ledgers**; dashboard shows **two gauges per TA card**; nav = **three floating pills**
(logo | pages | actions); polish = **visual consistency + motion & micro-interactions**; fix **all**
deferred minors.

## 1. Task kinds

### 1.1 Model
```ts
export type TaskKind = "light" | "heavy";
export const TASK_KINDS: readonly TaskKind[] = ["light", "heavy"];
interface Task { …; kind: TaskKind }                      // required
interface Workspace { …; ledgers: Record<TaskKind, Ledger> }   // replaces `ledger`
```
`emptyWorkspace()` → `ledgers: { light: {turn:1, used:{}}, heavy: {turn:1, used:{}} }`.

### 1.2 Engine rules
- Every command that touches a ledger uses `ws.ledgers[task.kind]`: `createTask` (command gains
  `kind`), `deleteTask`, `updateTask` (kind is immutable after creation — changing it would need a refund
  from one ledger and a charge on the other; not offered), `redistributeTask`, `reassignOccurrence`,
  `removeTA` (re-deals per kind, threading each kind's ledger separately), `setSemester` (truncate /
  extend per kind), `redistributeAll` (resets **both** ledgers, re-deals light tasks in creation order
  threading `ledgers.light`, then heavy tasks threading `ledgers.heavy`).
- `swapOccurrences` requires `a.kind === b.kind`; otherwise `ValidationError("Only tasks of the same
  kind can be swapped.")`.
- Capacity, turn-size and the highest-remaining-fraction rule are unchanged and evaluated per ledger.
- `describe()` labels unchanged except `Added heavy task "X"` / `Added light task "X"`.

### 1.3 Upgrade of stored documents
`app/engine/migrate.ts`: `upgradeWorkspace(doc: unknown): Workspace` — if the document has a legacy
`ledger` and tasks without `kind`: tasks get `kind: "light"`, `ledgers = { light: ledger, heavy: {turn:1,
used:{}} }`, `ledger` removed. Already-current documents pass through unchanged (same reference).
`loadWorkspace` applies it on every read and, if the document changed shape, writes it back once
(with an auto snapshot labelled `Upgraded to task kinds`). Snapshots are upgraded on rollback the same way.

### 1.4 UI
- **New task** step 1 gains a Light / Heavy segmented control (default Light) with a one-line
  explanation under it: "Light and heavy tasks are shared out independently — each has its own
  fairness counter." Preview gauges are the kind being created.
- **Tasks page**: filter chips All / Light / Heavy (search param `?kind=`), kind badge on each card.
- **Task detail**, **calendar pills**, **timeline rows**: kind badge (subtle pill: "Light" / "Heavy").
- **Swap pickers** (dashboard SwapSheet, calendar swap mode): targets limited to the same kind; the
  calendar dims other-kind pills in swap mode (same treatment as same-TA pills).
- **Dashboard**: per TA card two gauges side by side labelled Light / Heavy (`used/capacity` from the
  respective ledger); two `TurnHeader`s ("Light · Turn 2 · 5/8 units used", "Heavy · Turn 1 · 0/8 units
  used"); stats (`totalOccurrences`, `nextDates`) per card stay combined, with a small "3 light · 1
  heavy" caption.
- **Settings → Redistribute everything** copy adds "(both light and heavy)".

## 2. Navigation: three floating pills
- Desktop (`md+`): a fixed top header containing three independent glass pills with 12px gaps:
  left `[ icon + "TA Load" ]` (links to `/`), centre `[ Dashboard · Team · Tasks · Calendar · History ]`
  with the `layoutId` active indicator, right `[ theme toggle · settings ]`. The centre pill is
  horizontally centred in the viewport; the outer pills hug the edges with a 16px gutter.
- Mobile (`< md`): left and right pills only in the header; pages remain in the bottom tab bar (unchanged).
- Pills: `.glass`, 999px radius, 48px tall, subtle shadow; on scroll > 8px they gain a slightly
  stronger shadow (CSS `scroll-state` not required — a tiny `useScrolled()` hook with a passive
  listener, gated by `useMounted`).
- Reduced motion: indicator snaps; no hover lift.

## 3. Metadata and icons
- Icon: an SVG mark — two balanced pans on a beam (scales), accent `#6d5dfc` on transparent, with a
  `prefers-color-scheme: dark` media rule lightening the beam. Files in `public/`: `icon.svg`,
  `favicon.ico` (32), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `og.png`
  (1200×630: mark + "TA Load Distribution" + tagline on the light theme), `site.webmanifest`
  (`name`, `short_name: "TA Load"`, `theme_color` light `#f6f3ee`, `background_color`, icons).
  PNGs are rendered from the SVG with headless Chrome (no new dependencies); the generator script lives
  in `scripts/icons.mjs` and is documented in the README.
- `root.tsx` `<Links>`: `icon` (svg + ico), `apple-touch-icon`, `manifest`; `<Meta>` from root `meta()`:
  `description`, `theme-color` ×2 (media light/dark), `og:type website`, `og:site_name`, `og:image`,
  `twitter:card summary_large_image`, `robots index,follow`.
- Per-route `meta()` returns `title` ("Dashboard · TA Load Distribution" …), `description`,
  `og:title`, `og:description`, `og:url` (from `APP_URL` env, default `http://localhost:5173`),
  `canonical` link. Task detail title = `"<task title> · Tasks · TA Load Distribution"`.
- `APP_URL` documented in `.env.example` and README; Vercel sets it to the production URL.

## 4. Deferred minors (all fixed)
Grouped by area; each becomes a plan step with a named test where it is logic.

**Engine**: guard `pick()` on empty input (throw `RangeError`); `customDates` clamps count 1..500 and
gap ≥ 1; tests: capacity ignores dangling slot ids; rng different seeds differ + golden first value;
TZ/DST date generation; exactly-500 passes / 501 throws for daily and custom; capacity-shrink exhaustion;
stale ledger ids ignored; unsorted input assigned in date order; input arrays not mutated; reference
scenario over 5 seeds; NoCapacity leaves workspace deep-equal; setSemester refund; unknown ids;
empty schedule; `describe` for setSectionSlot/reassign/swap; updateTask without schedule; same-TA
reassign no-op; past-turn reassign doesn't decrement; cross-task swap; redistributeAll with an empty
task; redistributeTask preserves dates; swap test picks distinct TAs; shared `redeal()` helper replaces
the duplicated re-deal/remap code; `updateTask` accepts `notes: null` to clear; move `ta-colors` into
`app/engine/palette.ts` (engine must not import from `app/lib`).

**Server**: explicit `.limit()` on Supabase `listSnapshots` (500) and prune select; `MemoryStore` loses
the `beforePut` hook — tests use a `HookedMemoryStore` subclass in `app/server/__tests__/`; tests for
rollback version conflict, blank snapshot name rejected, `loadWorkspace` create race; `applyCommand`
returns `{ …, label }` computed from the loaded document so `api.command` stops loading twice.

**Shell / lib**: `useCommand` submits with a unique `fetcherKey` per call via `useSubmit` and an
`AppShell` watcher (`useFetchers`) shows the toast — fixes superseded toasts and toasts lost on
unmount; remove duplicate `useReducedMotion` calls; `--accent-ink` token (accent darkened to ≥ 4.5:1 on
`--bg` in both themes) used for accent *text* (toast Undo, links, captions); `focus-visible` rings on
toast buttons; `format.ts` stray comment + unused param removed; move the toast context to
`app/lib/toast.tsx` so lib never imports components; replace Header spacer divs with grid layout;
`backdrop-filter` blur reduced to 10px below `md`; tests for `api.history`, `api.preview`, `useCommand`.

**UI primitives**: `Field` renders a persistent `aria-live` region; Sheet re-focuses the panel when
focus escapes (focusout handler) and marks the app root `inert` while a sheet is open; drag spring-back
instant under reduced motion; `EmptyState` renders visible on the server (animate only after mount);
`Card` `will-change` only while hovered; `OccurrencePopover` drops the unused `ref` prop (route updated).

**Team**: `SlotPicker`/`ConfirmDialog` retain last content during exit (`useRetained(value)` helper in
`app/lib/retain.ts`); tests for `resolveDrop` paths already exist — add Clear, rename Enter/Escape/blank,
remove-confirm body text, SlotPicker same-TA guard; chip gets `title="Tap to rename, drag to a slot"`
and SR instructions mention the slot picker; `pending` disables the add buttons.

**Tasks**: count input shows the clamped value immediately; the New-task sheet stays open until the
create command resolves (closes on success, shows the error inline on failure); kebab menu: arrow-key
navigation + focus on open + Escape; `motion.li` gets `h-full`; wizard tests (type switch carry-over,
stale-preview guard, 500-cap gating); task detail not-found responds 404 (`throw data(…, { status: 404 })`
in a route loader) and the reassign `<Select>` keeps an optimistic value until revalidation.

**Dashboard**: tests for Timeline boundaries (today included, today+14 excluded, Today/Tomorrow
badges), `taStats` (max 3, ascending, unknown TAs ignored), SwapSheet a≠b; `CountUp` renders the animated
number `aria-hidden` plus an `sr-only` final value; swap state stores the TA id, not the object; sorted
imports; "1/8 unit" singular.

**Calendar**: remove `aria-pressed`; tests for swap-mode dimming, same-TA reassign no-op, `?m=`
fallback; `expanded` resets on month change; popover exits gracefully if its occurrence disappears.

**History / Settings**: Appearance control becomes real radio inputs (native roving behaviour);
semester draft re-seeds only when the panel opens; relative times tick every 30 s while mounted; shared
`messageOf()` helper; Save spinner scoped to the semester form; after Redistribute/Reset the panel
closes (tested); tests for `useHistory` resolve/false paths, `PasswordDialog` (stays open, shows
message), `SettingsPanel` validation, Undo toast; per-action fetcher keys on the History page; the
rollback auto-snapshot label becomes `Rolled back to before "<label>"` for auto rows.

**Polish-task leftovers**: `hover:text-accent-2` → `hover:text-danger-ink`; toast timers cleared when a
toast is dropped/dismissed; hover hold uses pointer events with `pointerType === "mouse"`; unused test
variable removed; `aria-disabled` buttons get `cursor: not-allowed`; labels/checkbox/backdrop sweep.

## 5. Polish pass
- **Visual system**: one spacing scale (4/8/12/16/24/32), one type scale (display 32/24/20, body 16/14,
  caption 12), shared `Badge` and `IconButton` primitives, consistent card padding (20px) and radii
  (20 cards / 14 inputs / 999 pills), consistent empty states (icon + title + body + action) on all pages,
  a single icon set (inline SVG components in `app/components/ui/icons.tsx`, 20px, 1.75 stroke).
- **Motion**: page-load choreography (header pills fade-down, content stagger 40ms per block, capped),
  hover/press details on cards (shadow + 1px lift), focus rings animate in, gauges and numbers animate on
  change, sheets/menus share one transition preset, success toasts get a small check-mark draw-on.
  Everything gated by reduced motion as before.

## 6. Out of scope
Changing a task's kind after creation; per-kind capacities; auth; realtime.
