# TA Load Distribution — Design Spec

## Context

A course coordinator needs a web tool that distributes recurring tasks (grading, proctoring, …)
fairly among teaching assistants, where "fair" is weighted by how many sections each TA teaches.
Today this is done by hand. The tool must be delightful to use (motion, dark/light, touch-friendly),
need no login, keep a full version history (snapshots + rollback), and run on Vercel with data in
Supabase.

The repo is a fresh `create-react-router` scaffold (React Router 8.4 + Tailwind v4 + Vite 8, SSR on,
one placeholder route). Everything below is new code.

Decisions already agreed with the user (do not re-ask):
- Storage: **Supabase Postgres**, single JSON workspace document + snapshots table.
- Custom schedule: count + gap generates dates, each date then editable.
- One TA per occurrence; capacity derived from section assignments; a section counts **+1 for both
  of its TAs**; single shared workspace; auto-snapshot every change + named manual snapshots;
  only *deleting history* needs the env-var password; reset needs no password.
- Keep both per-task **Redistribute** and global **Redistribute everything** (Settings, confirm dialog).
- TAs can **swap** occurrences with each other.

---

## Part A — Specification

### A1. Domain model (the JSON workspace document)

```ts
type ISODate = string;                       // "2026-10-20"
interface Workspace {
  semester: { name: string; start: ISODate; end: ISODate };
  tas: { id: string; name: string; color: string }[];          // color auto-assigned from palette
  sections: { id: string; name: string; taIds: [string|null, string|null] }[];
  tasks: Task[];
  ledger: { turn: number; used: Record<string /*taId*/, number> };
}
interface Task {
  id: string; title: string; notes?: string; createdAt: string;
  schedule:
    | { type: "one-time" | "per-semester"; date: ISODate }
    | { type: "daily" | "weekly" | "monthly"; start: ISODate; end: ISODate | null }   // null → semester end
    | { type: "custom"; start: ISODate; count: number; gapDays: number; dates: ISODate[] };
  occurrences: { id: string; date: ISODate; taId: string; turn: number }[];
}
```

Derived (never stored): `capacity(taId) = number of section slots holding taId`;
`remaining(ta) = (capacity − used) / capacity`; `turnSize = Σ capacity`.

### A2. Distribution engine (pure TypeScript, `app/engine/`)

**Occurrence generation** (`schedule.ts`):
- one-time / per-semester → 1 occurrence on `date`.
- daily / weekly / monthly → dates from `start`, stepping 1 day / 7 days / 1 calendar month
  (clamp day-of-month), while `≤ end ?? semester.end`. Guard: max 500 occurrences.
- custom → `dates` as stored (UI generates `start + i*gapDays` for i<count, user may edit any).

**Assignment** (`distribute.ts`) — `assign(ws, occurrences, rng) → ws'`:
for each occurrence in date order:
1. eligible = TAs with capacity > 0.  If none → throw `NoCapacityError`.
2. If every eligible TA has `used ≥ capacity` → `ledger.turn++`, all `used = 0`.
3. pick TA maximizing `remaining`; ties → `rng` pick. `used[ta]++`; occurrence gets `{taId, turn}`.

Reference test (must pass, from user's example): capacities A1 B2 C2 D3; task of 10 → after it,
counts are A2 B3 C2 D3 *or* any outcome where first 8 = 1/2/2/3 and last 2 go to distinct
max-remaining TAs; then with ledger `{A:1,B:1,C:0,D:0}` a task of 4 → C gets 1, D gets 2, last
goes to B or C. Use an injectable seeded RNG so tests are deterministic.

**Mutations** (`reducer.ts`, `reduce(ws, command, rng) → ws'`), all pure:
| command | effect on ledger |
|---|---|
| addTA / renameTA | none (new TA starts at used 0) |
| removeTA | drop from sections; its occurrences are re-assigned via `assign` after refund |
| addSection / setSectionSlot / removeSection | none (capacities change live) |
| createTask | generate occurrences → `assign` |
| updateTaskSchedule | refund current-turn units → regenerate → `assign` |
| deleteTask | refund: for each occurrence with `turn === ledger.turn`, `used[ta]−−` (min 0) |
| redistributeTask | refund (as above) → `assign` again |
| redistributeAll | `ledger = {turn:1, used:{}}`; re-run createTask assignment for all tasks in `createdAt` order |
| reassignOccurrence(occ, newTa) | `used[old]−−` (min 0, only if occ.turn === current turn), `used[new]++`; occ.turn = current |
| swapOccurrences(a, b) | trade `taId`s; ledger unchanged |
| setSemester | if `end` moved earlier, truncate occurrences past it (refund those) |
| reset | fresh empty workspace |

A `describe(command)` helper returns the human label used for auto-snapshots
("Added task 'Grade quiz'", "Swapped Ahmed ↔ Dina on Oct 20", …).

### A3. Persistence (Supabase)

```sql
create table workspace (
  id int primary key default 1 check (id = 1),
  data jsonb not null, version int not null default 0, updated_at timestamptz default now());
create table snapshots (
  id bigserial primary key, name text, label text not null, kind text check (kind in ('auto','manual')),
  data jsonb not null, version int not null, created_at timestamptz default now());
```
- Server only: `app/server/db.ts` uses `@supabase/supabase-js` with the **service-role key** read
  from env — never shipped to the browser. RLS enabled with no anon policies.
- `applyCommand(command)`: read row → `reduce` → write with `version = v+1 where version = v`;
  on conflict re-read and retry (≤3). Before the write, insert `snapshots(kind='auto', label=describe(cmd), data=OLD)`.
  Auto snapshots capped at 300 (delete oldest auto rows); manual ones never auto-pruned.
- `rollback(snapshotId)`: auto-snapshot current, then copy snapshot data into workspace.
- `reset`: auto-snapshot "Before reset", write empty workspace.
- `deleteHistory(password)`: compare to `HISTORY_DELETE_PASSWORD` (constant-time); delete all snapshots.
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HISTORY_DELETE_PASSWORD` (+ `.env.example`).
- **Supabase MCP is currently not connected** — ask user to connect it (or paste project URL +
  service key) at the start of implementation; create the project/tables via MCP `apply_migration`
  or hand the SQL to the user.

### A4. Routes & UI

Routes (`app/routes.ts`): `/` dashboard · `/team` · `/tasks` (+ `/tasks/new` sheet, `/tasks/:id`) ·
`/calendar` · `/history`. Settings is a slide-over panel on every page. One root `loader` reads the
workspace; every mutation is a `<fetcher.Form>` → route `action` → `applyCommand` → revalidate.
Preview on task creation calls an action with `intent=preview` that runs `reduce` **without saving**
and returns the proposed occurrences + resulting gauges.

Pages:
1. **Dashboard** — TA cards: name, color, capacity, liquid-fill gauge of `used/capacity` this turn
   (+ "Turn N · 5/8 units used" header), total occurrences, next 3 dates, "swap…" shortcut.
   Below: upcoming-occurrences timeline (next 14 days). Empty-state onboarding if no TAs.
2. **Team** — left: TA list (add/rename/remove, remove confirms & shows how many occurrences will move).
   Right: sections grid, each with 2 slots; drag TA chip → slot (dnd-kit, pointer + touch sensors);
   tap slot → picker fallback. Capacity badge per TA updates live.
3. **Tasks** — cards list (title, schedule summary, occurrence count, per-TA mini split bar,
   Redistribute / Delete). "New task" bottom-sheet (mobile) / modal (desktop), 3 steps with
   slide transitions: *Name → Schedule → Preview & confirm*. Custom schedule step: count + gap +
   start → editable date chips. `/tasks/:id`: occurrence list with reassign dropdown.
4. **Calendar** — month grid, occurrence pills colored by TA, tap → popover: reassign / swap
   (swap mode highlights the other occurrences; tap one to complete). Prev/next month animated.
5. **History** — timeline of snapshots (label, time, kind, name). Actions: Rollback (confirm),
   Save named snapshot (input), Delete history (password dialog → server check). Current version marker.
6. **Settings panel** — semester name/start/end, theme (system/light/dark), Redistribute everything
   (confirm), Reset everything (confirm; creates snapshot first).

Global: header with animated nav indicator + theme toggle (sun↔moon morph); toast stack with
**Undo** (= rollback to the auto-snapshot just created); error boundary styled.

### A5. Visual & motion design

- Tailwind v4 with CSS-variable tokens on `:root` / `[data-theme=dark]`; `@custom-variant dark`.
  Theme stored in `localStorage`, applied by an inline script in `<head>` before paint (no flash),
  default follows `prefers-color-scheme`.
- Fonts: display "Sora", body "Inter" (Google Fonts, already preconnected in `root.tsx`).
- Motion (`motion` v14): `AnimatePresence` page transitions, `layout` animations on list
  add/remove/reorder, spring gauges, count-up numbers, `whileHover` lift / `whileTap` squish on all
  interactive elements, drifting mesh-gradient background (CSS keyframes, `prefers-reduced-motion`
  respected everywhere), sheet drag-to-dismiss on mobile.
- Touch: ≥44px targets, dnd-kit `TouchSensor` with press delay, no hover-only affordances.

### A6. Stack decisions

- **React Router 8.4.0** (`react-router`, `@react-router/{dev,node,serve}`) — the user's decision
  (2026-10-16), accepting that `@vercel/react-router@1.3.7` declares only v7 peers (vercel/vercel#16730
  open). Install with a peer override; if Vercel's build rejects the preset, use Vercel's zero-config
  React Router path instead.
- Add: `motion`, `@supabase/supabase-js`, `@dnd-kit/core` + `@dnd-kit/utilities`, `@vercel/react-router`,
  `date-fns`, `nanoid`; dev: `vitest`, `@testing-library/react`, `jsdom`.
- `react-router.config.ts`: `presets: [vercelPreset()]`.

---

