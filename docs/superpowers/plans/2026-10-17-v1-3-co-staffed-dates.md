# v1.3 — Co-staffed dates (1, 2 or more TAs per task) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A task declares how many TAs cover each of its dates; the engine seats that many distinct TAs per date with the same fairness rule, and every surface shows and swaps individual seats.

**Architecture:** The occurrence's single `taId`/`turn` becomes `seats: Seat[]`; a seat is exactly today's occurrence, so the ledger math is unchanged. `assignOccurrences` gains `taCount` and may keep already-held seats (refill). Swaps and reassignments address a `SeatRef`. A second migration step wraps stored occurrences. UI surfaces iterate seats; the calendar and dashboard swap flows pick a seat; the wizard gains a stepper.

**Tech Stack:** unchanged (React Router 8, Vitest, Tailwind, motion). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-17-v1-3-co-staffed-dates-design.md`

## Global Constraints

- Exact copy from the spec: `"This task needs 3 TAs but only 2 have sections."` (singular `"… but only 1 has sections."`; code `NOT_ENOUGH_TAS`), `"TAs per date must be a whole number of at least 1."`, `"A TA can't hold the same date twice."`, snapshot label `Upgraded to co-staffed dates`, history label `Added heavy task "X" for 2 TAs`, stepper hints `Each date is covered by this many TAs together. Every one of them counts it toward their load.` / `Give more TAs sections to co-staff dates.`, summary suffix ` · 2 TAs per date`.
- `taCount === 1` behaviour is byte-for-byte today's: single-TA pills, labels, deals and ledgers do not change. Existing tests change only in fixture shape.
- The engine (`app/engine`) imports nothing from `lib`, `components` or `server` (`boundaries.test.ts`).
- ≥44px targets, reduced-motion safe, hydration-safe, tokens only, mutations via `useCommand`.
- No AI-attribution trailers or tool mentions in commits or files.
- Work on branch `feat/co-staffed-dates`. The type change ripples through the UI, so `npm run typecheck` is expected to fail after Tasks 1–5 and **must be green from Task 6 onward and before every later commit**. Before each commit run the tests named in that task's gate; `npm test` must be fully green from Task 6.

## Review Focus

1. Removing a TA that leaves a 2-TA task with only 2 eligible TAs must be rejected and change nothing (Task 2 test `removeTA is rejected when a seat cannot be refilled`).
2. `redistributeAll` with one undealable task must leave the whole workspace unchanged (Task 2 test `redistributeAll is atomic`).
3. A rollback to a v1.0 or v1.1 snapshot must upgrade through the whole chain (Task 3 test `rollback upgrades a v1.1 snapshot`).
4. Two TAs with similar hues on one gradient pill: the names must be in the accessible name (Task 5 test `multi-seat pill names every TA`).
5. The wizard stepper sits at 2 while TAs with sections drop to 1 before Confirm: the command must be clamped (Task 7 test `taCount is clamped to the eligible count`).

---

### Task 1: Model and dealing engine

**Files:**
- Modify: `app/engine/types.ts`, `app/engine/capacity.ts`, `app/engine/distribute.ts`
- Test: `app/engine/__tests__/distribute.test.ts`, `app/engine/__tests__/capacity.test.ts`

**Interfaces (produces):**
```ts
// types.ts
export interface Seat { taId: string; turn: number }
export interface Occurrence { id: string; date: ISODate; seats: Seat[] }
export interface Task { …; taCount: number }
export type SeatRef = OccurrenceRef & { taId: string };
// Command changes:
| { type: "createTask"; kind: TaskKind; title: string; notes?: string; schedule: Schedule; taCount?: number }
| { type: "reassignOccurrence"; ref: OccurrenceRef; from: string; taId: string }
| { type: "swapOccurrences"; a: SeatRef; b: SeatRef }
export class NotEnoughTAsError extends EngineError { constructor(needed: number, available: number) /* message per spec, code "NOT_ENOUGH_TAS" */ }
// capacity.ts
export function eligibleCount(ws: Workspace): number   // TAs with capacity > 0
// distribute.ts
export interface PendingOccurrence { id: string; date: ISODate; seats?: Seat[] }
export function assignOccurrences(args: { capacities: Record<string, number>; ledger: Ledger; occurrences: PendingOccurrence[]; taCount: number; rng: Rng }): { ledger: Ledger; occurrences: Occurrence[] }
export function refund(ledger: Ledger, occurrences: Occurrence[]): Ledger          // every current-turn seat
export function refundSeats(ledger: Ledger, seats: Seat[]): Ledger
```

- [ ] **Step 1: Rewrite `distribute.test.ts` fixtures to seats.** `count` reads `o.seats.map(s => s.taId)`; every `assignOccurrences` call passes `taCount: 1`; `refund` fixtures become `{ id, date, seats: [{ taId: "A", turn: 2 }] }`; `o.turn` reads become `o.seats[0].turn`. Add the failing tests:
  - `taCount 2 seats two distinct TAs with the highest remaining fractions`: caps `{A:1,B:2,C:2,D:3}`, 4 dates, `taCount: 2` → for seeds 1–5: every occurrence has 2 seats with distinct `taId`s, all `turn 1`, and `ledger.used` equals `{A:1,B:2,C:2,D:3}` (a full turn exactly).
  - `a seat with nobody left to take it starts the new turn instead of overshooting`: caps `{A:1,B:1}`, ledger `{turn:1, used:{A:1}}`, 1 date, `taCount: 2` → seats `[{B,1},{A,2}]`, ledger `{turn:2, used:{A:1}}`.
  - `a turn is never over-full`: caps `{A:1,B:2,C:2,D:3}`, start `used:{A:1}`, six 2-TA dates → after each, the used total ≤ 8 and no TA exceeds capacity.
  - `fewer eligible TAs than taCount throws NotEnoughTAsError before dealing`: caps `{A:1,B:1,C:0}`, `taCount: 3` → `toThrow(new NotEnoughTAsError(3, 2))` and the message equals `"This task needs 3 TAs but only 2 have sections."`.
  - `no capacity anywhere still throws NoCapacityError even with taCount 2`.
  - `refill keeps held seats and never seats their TAs again`: caps `{A:1,B:1,C:1}`, one pending `{ id, date, seats: [{taId:"A",turn:1}] }`, `taCount: 2`, ledger `{turn:1, used:{A:1}}` → result seats `[{A,1}, {X,1}]` with X ∈ {B,C}; `used[A]` stays 1 (kept seats are not charged).
  - `refundSeats releases only current-turn seats and floors at 0`.
  - `eligibleCount counts TAs with capacity > 0` (in `capacity.test.ts`, using the `team()` fixture → 4; after clearing every slot → 0).
- [ ] **Step 2: Run** `npx vitest run app/engine/__tests__/distribute.test.ts app/engine/__tests__/capacity.test.ts` → FAIL (shape/type errors).
- [ ] **Step 3: Implement** the types above; `NotEnoughTAsError`; `eligibleCount`; `assignOccurrences` per spec §2.1 (eligibility checks once up front; per seat: if every eligible TA not yet seated on the occurrence is full → `turn++`, `used = {}`; then pick the highest remaining fraction among those TAs, ties via `pick(tied, rng)`); `refund` via `refundSeats`.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(engine): seats per occurrence; deal taCount distinct TAs per date`.

### Task 2: Reducer

**Files:**
- Modify: `app/engine/reducer.ts`
- Test: `app/engine/__tests__/fixtures.ts`, `reducer-tasks.test.ts`, `reducer-team.test.ts`, `reducer-semester.test.ts`, `kinds.test.ts`

**Interfaces:** consumes Task 1. Produces the reducer behaviour of spec §2.3; helper `findSeat(ws, ref: SeatRef): { task: Task; occ: Occurrence; seat: Seat }` (throws `ValidationError("Unknown TA.")` when the TA does not hold the date).

- [ ] **Step 1: Update existing tests to the seat shape**: `occ.taId` → `occ.seats[0].taId`, `occ.turn` → `occ.seats[0].turn`, swap commands gain `taId` on both refs, `reassignOccurrence` gains `from`. No assertion values change. Add the failing tests (all on the `team()` fixture, A1 B2 C2 D3):
  - `createTask with taCount 2 seats two distinct TAs per date and charges both`: daily 4 days, `taCount: 2` → `task.taCount === 2`, every occurrence has 2 distinct seats, `ledgers.light.used` totals 8.
  - `createTask defaults taCount to 1 and validates it`: omitted → 1; each of `0`, `-1`, `1.5`, `"2"`, `NaN` → `toThrow(new ValidationError("TAs per date must be a whole number of at least 1."))`.
  - `createTask with taCount above the eligible count throws NotEnoughTAsError and changes nothing`: `taCount: 5` → throws with message `"This task needs 5 TAs but only 4 have sections."`; the thrown call leaves the input workspace unchanged (pure).
  - `updateTask schedule re-deals with the task's taCount`: 2-TA task, new one-time date → 1 occurrence with 2 seats, ledger total 2.
  - `removeTA refills only the removed TA's seats with a distinct TA`: 2-TA task over 4 dates; remove A → every occurrence still has 2 distinct seats, none is A, the seats that were not A keep their `taId` and `turn`, refilled seats carry `turn === ledger.turn`.
  - `removeTA is rejected when a seat cannot be refilled`: team of exactly 2 eligible TAs (add 2 TAs, one section each slot), a 2-TA task; remove one → `toThrow(NotEnoughTAsError)` and `expect(reduce(...)).toThrow` leaves the input unchanged (`toEqual` snapshot before/after).
  - `redistributeAll is atomic`: 2-TA task + a 1-TA task; clear section slots until exactly one TA is eligible; `redistributeAll` → throws `NotEnoughTAsError`; input workspace deep-equals its pre-call snapshot.
  - `swapOccurrences trades one seat and keeps turns with the seat`: two 2-TA occurrences; swap seat X on a with seat Y on b → a now holds Y with b's old turn, b holds X with a's old turn, the other seats untouched, ledgers unchanged.
  - `swapOccurrences rejects seating a TA twice`: b already contains X → `toThrow(new ValidationError("A TA can't hold the same date twice."))`.
  - `swapOccurrences same TA is a no-op; unknown seat throws Unknown TA.`
  - `reassignOccurrence moves a seat and rejects a duplicate`: `{ ref, from: X, taId: Y }` on a 2-TA occurrence where Y is the other seat → `toThrow(new ValidationError("A TA can't hold the same date twice."))`; with a free Z → seat becomes Z and the current-turn unit moves.
  - `setSemester extension deals new dates with the task's taCount`: 2-TA weekly task with no end; extend the semester end by two weeks → each new occurrence has 2 distinct seats and existing seats are untouched.
  - `describe labels`: `createTask` with `taCount: 2` → `Added heavy task "Lab" for 2 TAs`; with 1 → `Added heavy task "Lab"`; swap → `Swapped A ↔ B` using the seat TAs.
- [ ] **Step 2: Run** `npx vitest run app/engine` → FAIL.
- [ ] **Step 3: Implement** spec §2.3 in `reducer.ts`: `createTask` validation (`Number.isInteger(taCount) && taCount >= 1`) and `taCount` threaded to every `assignOccurrences`/`redeal` call; `redeal` keeps ids/dates and passes `taCount` (no kept seats); `removeTA` per kind: orphan seats → `refundSeats`, `delete used[taId]`, refill via `assignOccurrences({ occurrences: [{ id, date, seats: remaining }], taCount: task.taCount })` threading the ledger; `swapOccurrences`/`reassignOccurrence` via `findSeat`; `describe` labels.
- [ ] **Step 4: Run** `npx vitest run app/engine` → PASS (except `migrate.test.ts`, fixed in Task 3; note any remaining failures there only).
- [ ] **Step 5: Commit** `feat(engine): taCount on tasks; seat-level swaps, reassigns and TA removal refills`.

### Task 3: Migration chain and command reader

**Files:**
- Modify: `app/engine/migrate.ts`, `app/server/workspace.server.ts` (`UPGRADE_SNAPSHOT_LABEL`), `app/server/responses.server.ts`, `app/server/store.ts` (doc comment)
- Test: `app/engine/__tests__/migrate.test.ts`, `app/server/__tests__/workspace.test.ts`, `app/routes/__tests__/api.command.test.ts`

**Interfaces:** `upgradeWorkspace(doc: unknown): Workspace` and `isCurrentWorkspace(doc: unknown): doc is Workspace` keep their signatures. `readCommand` additionally returns `null` when `createTask.taCount` is present and not a number, or when `swapOccurrences` refs lack string `taId`s.

- [ ] **Step 1: Tests.** In `migrate.test.ts` add a `v11()` fixture (ledgers, task with `kind`, occurrence `{ id, date, taId, turn }`, no `taCount`). Update the "current" shape cases: `occurrence taId not a string` → `occurrence seats missing`, `seats empty`, `seat taId not a string`, `seat turn not a number`, plus `task taCount missing`, `taCount 0`, `taCount 1.5`. Add:
  - `v1.1 document upgrades to seats and taCount 1`: occurrence becomes `{ id, date, seats: [{ taId, turn }] }` with no `taId`/`turn` keys; `tasks[0].taCount === 1`; ledgers unchanged; input not mutated; `isCurrentWorkspace(out)` true.
  - `v1.0 document upgrades through the whole chain` (the existing `legacy()` → seats + kinds + ledgers + `taCount`).
  - `mixed v1.1 document accepts tasks already in the new shape`.
  - In `workspace.test.ts`: `loading a v1.1 row writes it back once with the label "Upgraded to co-staffed dates"`; `rollback upgrades a v1.1 snapshot`.
  - In `api.command.test.ts`: `createTask with taCount "2" is rejected with Invalid command.`; `swapOccurrences without taId on a ref is rejected with Invalid command.`; `createTask with taCount 2 returns 400 "This task needs 2 TAs but only 1 have sections."` after seeding one TA with one slot (use the memory store as the other tests do).
- [ ] **Step 2: Run** `npx vitest run app/engine app/server app/routes/__tests__/api.command.test.ts` → FAIL.
- [ ] **Step 3: Implement**: `isV11Workspace(doc)` (has `ledgers`, every occurrence has string `taId` + numeric `turn` or already `seats`, tasks may lack `taCount`); `upgradeWorkspace` = v1.0→v1.1 (existing) then v1.1→v1.3; `isCurrentWorkspace` per spec §3; label constant; `readCommand` guards. Update the `store.ts` comment to mention both legacy shapes.
- [ ] **Step 4: Run** the same command → PASS. Run `npx vitest run app/engine/__tests__/boundaries.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(migrate): upgrade v1.1 documents to seats and taCount`.

### Task 4: UI reads seats (non-swap surfaces)

**Files:**
- Modify: `app/lib/format.ts`, `app/components/dashboard/stats.ts`, `app/components/dashboard/Timeline.tsx`, `app/components/tasks/SplitBar.tsx`, `app/components/tasks/TaskCard.tsx`, `app/components/tasks/StepPreview.tsx`, `app/routes/task-detail.tsx`, `app/routes/team.tsx`
- Test: `app/lib/__tests__/format.test.ts`, `stats.test.ts`, `Timeline.test.tsx`, `SplitBar.test.tsx`, `TaskCard.test.tsx`, `StepPreview.test.tsx`, `task-detail.test.tsx`, `team.optimistic.test.tsx`, plus any fixture in `app/components/**/__tests__` and `app/routes/__tests__` still using `taId` on an occurrence (`grep -rn "taId" app --include='*.test.ts*'` lists them; section `taIds` stay).

**Interfaces (produces):**
```ts
// format.ts
export function fmtTaskSummary(task: Pick<Task, "schedule" | "taCount">): string   // fmtScheduleSummary + " · N TAs per date" when taCount > 1
```
`SplitBar`, `taStats`, `Timeline` keep their signatures and iterate `occ.seats`.

- [ ] **Step 1: Update fixtures** in the listed tests to `seats: [{ taId, turn }]` and `taCount: 1` on tasks. Add failing tests:
  - `fmtTaskSummary appends the TA count only above 1`: weekly, `taCount: 1` → unchanged string; `taCount: 2` → ends with ` · 2 TAs per date`.
  - `taStats counts seats`: a 2-seat occurrence adds 1 to each TA's `totalOccurrences` and `counts[kind]`, and the date appears in both TAs' `nextDates`.
  - `SplitBar counts seats`: 2 occurrences × 2 seats → aria-label `Split: A 2, B 2`.
  - `Timeline lists every TA on a date`: one 2-seat row renders both TA badges.
  - `StepPreview shows a chip per seat` and `task detail shows a chip per seat`.
  - `TaskCard subtitle uses fmtTaskSummary` (2-TA task shows the suffix).
- [ ] **Step 2: Run** `npx vitest run app/lib app/components/dashboard app/components/tasks app/routes/__tests__/task-detail.test.tsx app/routes/__tests__/team.optimistic.test.tsx` → FAIL.
- [ ] **Step 3: Implement**: `fmtTaskSummary`; iterate seats in `stats.ts` (`for (const s of o.seats)`), `Timeline` (`tas: TA[]` per row, one `Badge` each), `SplitBar` (counts over seats; `total` = seat count), `team.tsx` counts, `task-detail.tsx` and `StepPreview.tsx` chips (one chip per seat, seat order), `TaskCard` subtitle.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(ui): surfaces read seats; task summaries show TAs per date`.

### Task 5: Calendar pill, popover and seat-level swap mode

**Files:**
- Create: `app/lib/swap.ts`
- Modify: `app/components/calendar/OccurrencePill.tsx`, `OccurrencePopover.tsx`, `DayCell.tsx`, `MonthGrid.tsx`, `app/routes/calendar.tsx`
- Test: `app/lib/__tests__/swap.test.ts`, `DayCell.test.tsx`, `MonthGrid.test.tsx`, `calendar.render.test.tsx`, `calendar.popover-exit.test.tsx`, `app/lib/__tests__/calendar.test.ts`

**Interfaces (produces):**
```ts
// lib/swap.ts
export type SeatSource = { task: Task; occ: Occurrence; taId: string };
/** TA ids of seats on `target` the source seat may trade with (spec §4.3 rules); [] = ineligible. */
export function swappableSeats(source: SeatSource, target: { task: Task; occ: Occurrence }): string[]
// OccurrencePill: `ta: TA | undefined` → `tas: (TA | undefined)[]` (seat order)
// OccurrencePopover props: { open; task; occ; tas: TA[]; mode: "view" | "pick"; pickable?: string[]; onStartSwap: (taId: string) => void; onPickSeat?: (taId: string) => void; onClose }
// DayCell/MonthGrid: `swapSource: SeatRef | null`; DayCell receives `swapFrom: SeatSource | null` instead of `swapTaId`/`swapKind`
// calendar.tsx state: swapSource: SeatRef | null; popover: { ref: OccurrenceRef; open: boolean; mode: "view" | "pick" } | null
```

- [ ] **Step 1: Failing tests.**
  - `swap.test.ts`: table over the rules — same occurrence → `[]`; other kind → `[]`; source TA already on target → `[]`; seats equal to source TA excluded; seats already on the source occurrence excluded; remaining seats returned in seat order.
  - `multi-seat pill names every TA`: pill with seats A,B → accessible name `Lab · Oct 5 · Sara, Omar · Heavy`; its stripe element (`data-stripe`) has a `background` containing both colours as a `linear-gradient(to bottom, …)`; the button's background is a `linear-gradient(to right, …)` with `28%`.
  - `single-seat pill is unchanged`: `border-l-4` present, background `color-mix(in srgb, <color> 22%, transparent)`, no gradient.
  - `popover lists every seat with its own Swap button` (view mode: 2 rows, 2 buttons named `Swap Sara`, `Swap Omar`; heading `Assigned TAs`); `popover in pick mode lists only pickable seats and no Open task link`.
  - `DayCell dims pills with no swappable seat and pulses those with one`.
  - `calendar swap: tapping a valid 1-seat pill submits swapOccurrences with both taIds`; `tapping a multi-seat pill opens the seat chooser and picking submits`.
- [ ] **Step 2: Run** `npx vitest run app/lib/__tests__/swap.test.ts app/components/calendar app/routes/__tests__/calendar.render.test.tsx app/routes/__tests__/calendar.popover-exit.test.tsx app/lib/__tests__/calendar.test.ts` → FAIL.
- [ ] **Step 3: Implement** per spec §4.3: pill styles (1 seat unchanged; more: gradient background at 28%, stripe `<span aria-hidden data-stripe>` with equal hard bands `linear-gradient(to bottom, c1 0% 50%, c2 50% 100%)`), popover modes, `swappableSeats`, DayCell roles, route `onSelect` (0 valid → ignore, 1 → submit, more → open popover `mode: "pick"`), `onStartSwap(taId)` sets `swapSource = { ...ref, taId }`.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(calendar): multi-TA pills; seat-level swaps with a seat chooser`.

### Task 6: Dashboard swap sheet; typecheck green

**Files:**
- Modify: `app/components/dashboard/SwapSheet.tsx`, `app/routes/home.tsx` (if its types changed)
- Test: `app/components/dashboard/__tests__/SwapSheet.test.tsx`, `app/routes/__tests__/home.swap.test.tsx`

**Interfaces:** `SwapPicker.onSwap(a: SeatRef, b: SeatRef)`; step 2 rows are seats (`OccurrenceList` takes `rows: { task; occ; taId }[]` grouped by task).

- [ ] **Step 1: Failing tests.** `step 1 lists the dates the TA sits on` (2-seat occurrence containing the TA appears once); `step 2 lists one row per swappable seat with its owner` (a 2-seat occurrence with owners B and C → two rows, named by owner); `a seat whose TA already sits on the picked date is not listed`; `picking submits swapOccurrences with a = { …first, taId: ta.id } and b = the row's seat`.
- [ ] **Step 2: Run** `npx vitest run app/components/dashboard app/routes/__tests__/home.swap.test.tsx` → FAIL.
- [ ] **Step 3: Implement** using `swappableSeats` from Task 5.
- [ ] **Step 4: Run** `npm run typecheck && npm test` → both PASS (first fully green point of the branch).
- [ ] **Step 5: Commit** `feat(dashboard): swap sheet trades individual seats`.

### Task 7: Wizard stepper, preview error path, README

**Files:**
- Create: `app/components/ui/Stepper.tsx`
- Modify: `app/components/tasks/StepName.tsx`, `app/components/tasks/NewTaskSheet.tsx`, `README.md`
- Test: `app/components/ui/__tests__/Stepper.test.tsx`, `StepName.test.tsx`, `NewTaskSheet.test.tsx`

**Interfaces (produces):**
```ts
// ui/Stepper.tsx
export function Stepper(props: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; describedBy?: string }): JSX.Element
// role="group" aria-label={label}; buttons "Decrease"/"Increase" (44px, disabled at the bounds); value in role="spinbutton" with aria-valuenow/min/max, ArrowUp/ArrowDown change it.
// StepName: value gains taCount; props gain maxTaCount: number
type StepNameValue = { kind: TaskKind; title: string; notes: string; taCount: number }
// NewTaskSheet Wizard: state.taCount (default 1); maxTaCount = Math.max(1, eligibleCount(workspace)); command() sends taCount: Math.min(taCount, maxTaCount)
```

- [ ] **Step 1: Failing tests.**
  - `Stepper clamps at min and max and is keyboard operable`.
  - `StepName shows a TAs per date stepper capped at the eligible count with the hint` (max 3 → `aria-valuemax="3"`, hint text per Global Constraints); `with one or no eligible TAs the stepper is capped at 1 and shows the other hint`.
  - `NewTaskSheet sends taCount in createTask` (set 2 → preview and create bodies contain `taCount: 2`).
  - `taCount is clamped to the eligible count` (workspace with 1 eligible TA, state forced to 2 via the stepper being at max then workspace mock returning fewer eligible → command has `taCount: 1`).
  - `a NotEnoughTAsError from the preview renders in the preview error block`.
- [ ] **Step 2: Run** `npx vitest run app/components/ui/__tests__/Stepper.test.tsx app/components/tasks` → FAIL.
- [ ] **Step 3: Implement** per spec §4.1; README paragraph "TAs per date" under "The distribution rule" (co-staffing, one unit per TA, fixed at creation, rejection when too few TAs have sections).
- [ ] **Step 4: Run** `npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** `feat(tasks): choose how many TAs cover each date`.

### Task 8: Verification and release

- [ ] `npm run typecheck && npm test && npm run build` green.
- [ ] Headless checks (CDP device emulation for 375px, light and dark): create a 2-TA task end to end (stepper → preview chips → confirm); calendar pill gradient and banded stripe; popover seat rows; calendar swap with a seat chooser; dashboard swap sheet; task detail chips; dashboard gauges reflect double units. Confirm a 1-TA task looks identical to before.
- [ ] Load a copy of a v1.1 document through the memory store and confirm the upgrade snapshot label.
- [ ] Merge `feat/co-staffed-dates` into `main`, push (Vercel deploys); verify the live URL.
