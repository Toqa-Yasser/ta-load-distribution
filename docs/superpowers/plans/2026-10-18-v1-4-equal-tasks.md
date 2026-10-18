# v1.4 — Equal tasks (round-robin over a chosen TA order) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third task kind, Equal, deals dates round-robin over a TA order the coordinator picks in the wizard, ignoring section load, with no ledger.

**Architecture:** `TaskKind` gains `"equal"`; the two ledgered kinds become `LoadKind`. An Equal task stores `taOrder` and is dealt by a new pure function `dealEqual` (fewest seats in this task wins, ties by order position), which also refills a removed TA's seats. The reducer dispatches on kind; everything that reads `ledgers` iterates `LOAD_KINDS`. UI gains an Equal option, an order list in the wizard, an amber badge and dot, an Equal filter chip, an order row on the detail page and per-TA date counts in the preview.

**Tech Stack:** unchanged (React Router 8, Vitest + Testing Library, Tailwind v4, motion). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-v1-4-equal-tasks-design.md`

## Global Constraints

- Exact copy from the spec: `"Pick the TA order for an equal task."`, `"Add TAs on the Team page first."`, `"Lab" has no TA left to cover its dates.`, `This task needs 3 TAs but only 2 are in its order.` (singular `… but only 1 is in its order.`), `"Lab" needs 2 TAs on each date but only 1 is in its order.`, history label `Added equal task "X"`, kind hint `Equal tasks go round the TAs in the order below, one date each, whatever their sections.`, stepper hints `Each date is covered by this many TAs together, taken in turn from the order.` / `Add more TAs to co-staff dates.`, button `Team list order`, preview heading `After this equal task`, caption `3 light · 1 heavy · 2 equal`, settings body `(light, heavy and equal)`.
- Light and heavy behaviour is byte-for-byte today's: every existing message, ledger rule and test stays, apart from iterating `LOAD_KINDS` where a test loops over ledgers.
- `dealEqual` takes no rng. The engine (`app/engine`) imports nothing from `lib`, `components` or `server` (`boundaries.test.ts`).
- ≥44px targets, reduced-motion safe, tokens only (no raw colours in components), mutations via `useCommand`.
- No AI-attribution trailers or tool mentions in commits or files.
- Work on branch `feat/equal-tasks`. `ledgers` becomes `Record<LoadKind, Ledger>` in Task 1, so `npm run typecheck` is expected to fail after Tasks 1–3 and **must be green from Task 4 onward and before every later commit**. Run the tests named in each task's gate before its commit; `npm test` must be fully green from Task 4.

## Review Focus

1. The wizard's order goes stale when a TA is removed or added in another tab before Confirm: the command must drop unknown ids and append new TAs rather than be rejected (Task 6 test `the order sent is reconciled with the current team`).
2. Removing a TA who is in an Equal task's order but holds no seat in it (fewer dates than TAs) must just shrink the order, with no error and no re-deal (Task 2 test `removeTA shrinks the order of an Equal task even when the TA held no seat`).
3. Removing a TA from a 2-TA Equal task whose order would then hold one TA must be refused with the task's title and change nothing (Task 2 test `removeTA is refused when an Equal order becomes too short for taCount`).
4. Creating an Equal task with no TAs: the wizard disables Next and says so; the API still answers with the engine message (Task 1 test `an empty order throws the wizard message`, Task 6 test `with no TAs the order list is replaced by the message and Next is disabled`).
5. `?kind=equal` with no Equal tasks must show the empty state for that kind and clear back to All (Task 5 test `the equal filter with no equal tasks shows the empty state`).

---

### Task 1: Model and `dealEqual`

**Files:**
- Modify: `app/engine/types.ts`
- Create: `app/engine/equal.ts`
- Test: create `app/engine/__tests__/equal.test.ts`; modify `app/engine/__tests__/kinds.test.ts:21-24`

**Interfaces (produces):**
```ts
// types.ts
export type TaskKind = "light" | "heavy" | "equal";
export type LoadKind = "light" | "heavy";
export const TASK_KINDS = ["light", "heavy", "equal"] as const satisfies readonly TaskKind[];
export const LOAD_KINDS = ["light", "heavy"] as const satisfies readonly LoadKind[];
export const KIND_LABEL: Record<TaskKind, string>;             // + equal: "Equal"
export function isLoadKind(kind: TaskKind): kind is LoadKind;
export interface Task { …; taOrder?: string[] }
export interface Workspace { …; ledgers: Record<LoadKind, Ledger> }
// Command: createTask gains `taOrder?: string[]`
export class NotEnoughTAsError extends EngineError {
  constructor(needed: number, available: number, taskTitle?: string, public readonly reason: "sections" | "order" = "sections")
  // reason "order" swaps the tail for `${available} ${available === 1 ? "is" : "are"} in its order.`
}
// equal.ts
export function dealEqual(args: {
  order: string[];
  occurrences: PendingOccurrence[];   // from distribute.ts; kept seats stay first
  taCount: number;
  held?: Occurrence[];                // the task's untouched occurrences (refill); default []
  taskTitle?: string;                 // named errors when set (paths outside the wizard)
}): Occurrence[]
```

- [ ] **Step 1: Write the failing tests** in `equal.test.ts` (dates `d(n) = \`2026-10-0${n}\``, ids `o${n}`):
  - `six dates over A, B, D rotate A B D A B D with rounds 1 1 1 2 2 2`: `taCount: 1` → `seats.map(s => s.taId)` is `["A","B","D","A","B","D"]`, turns `[1,1,1,2,2,2]`.
  - `taCount 2 seats distinct TAs and keeps every TA within one date of the others`: order `["A","B","D"]`, 3 dates → seats `[[A1,B1],[D1,A2],[B2,D2]]` written as `{ taId, turn }`.
  - `ties follow order position`: order `["D","A","B"]`, 2 dates, `taCount: 1` → `D` then `A`.
  - `a refill counts held seats and skips TAs already on the date`: order `["A","D"]`, `held` = occurrences d1→A(1), d3→D(1), d4→A(2); pending d2 `{ seats: [] }` and d5 `{ seats: [] }`, `taCount: 1` → d2 gets `{ taId: "D", turn: 2 }`, d5 gets `{ taId: "A", turn: 3 }` (A and D tie at two seats; A is earlier in the order); held occurrences are not in the output.
  - `kept seats are preserved first and never duplicated`: order `["A","B"]`, pending d1 `{ seats: [{ taId: "B", turn: 1 }] }`, `taCount: 2` → seats `[{B,1},{A,1}]`.
  - `an empty order throws the wizard message`: `order: []` → `toThrow(new ValidationError("Add TAs on the Team page first."))`; with `taskTitle: "Lab"` → `'"Lab" has no TA left to cover its dates.'`.
  - `a short order throws NotEnoughTAsError with order wording`: order `["A"]`, `taCount: 2` → message `"This task needs 2 TAs but only 1 is in its order."`, `reason` `"order"`, code `NOT_ENOUGH_TAS`; with `taskTitle: "Lab"` → `'"Lab" needs 2 TAs on each date but only 1 is in its order.'`; order `["A"]`, `taCount: 3` → `"… but only 1 is in its order."` and order `["A","B"]`, `taCount: 3` → `"… only 2 are in its order."`.
  - `a failed deal throws before touching anything`: the input `occurrences` array and its objects are unchanged after a throw (`toEqual` a deep copy taken before).
  - `NotEnoughTAsError keeps today's wording by default`: `new NotEnoughTAsError(3, 2).message === "This task needs 3 TAs but only 2 have sections."`.
  - In `kinds.test.ts` replace the first test: `TASK_KINDS` equals `["light","heavy","equal"]`, `LOAD_KINDS` equals `["light","heavy"]`, `emptyWorkspace().ledgers` still equals `{ light: fresh, heavy: fresh }`, and `isLoadKind("equal")` is false.
- [ ] **Step 2: Run** `npx vitest run app/engine/__tests__/equal.test.ts app/engine/__tests__/kinds.test.ts` → FAIL (module and symbols missing).
- [ ] **Step 3: Implement** the types above and `dealEqual` per spec §2.1: run both checks first; `count` = seats per TA over `held`, the pending occurrences' kept seats, and picks so far; for each pending occurrence sorted by date (stable), fill to `taCount` by choosing the candidate (in `order`, not on the date) with the smallest `count`, ties to the earliest in `order`; `count++`; seat `{ taId, turn: count }`.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(engine): equal kind and round-robin dealing over a TA order`.

### Task 2: Reducer

**Files:**
- Modify: `app/engine/reducer.ts` (imports, `dealFor`, `redeal`, `removeTA` 140–178, `setSemester` 209–244, `createTask` 249–276, `updateTask` 280–304, `deleteTask`, `redistributeTask`, `redistributeAll`, `reassignOccurrence`, `swapOccurrences`)
- Test: create `app/engine/__tests__/reducer-equal.test.ts`; modify `app/engine/__tests__/fixtures.ts`, `ledger-invariants.test.ts` (loops over ledgers → `LOAD_KINDS`)

**Interfaces:** consumes Task 1. Produces the §2.2 command behaviour. Add to `fixtures.ts`:
```ts
/** team() plus a fifth TA "E" with no sections. */
export function teamWithE(): { ws: Workspace; id: (name: string) => string }
export function equalDaily(ws: Workspace, order: string[], days: number, title = "Duty", taCount = 1): Workspace
  // createTask { kind: "equal", taOrder: order, schedule daily 2026-10-01..2026-10-<days> }
```

- [ ] **Step 1: Write the failing tests** in `reducer-equal.test.ts` (names via `id()`; `names(occs) = occs.map(o => o.seats.map(s => name(s.taId)))`):
  - `createTask equal rotates over the order, ignores sections and leaves both ledgers fresh`: `teamWithE()`, order `[A, B, E]`, 6 days → names `A B E A B E`, `task.taOrder` equals the order, `task.kind === "equal"`, `ledgers` equals `{ light: fresh, heavy: fresh }` and has exactly those two keys.
  - `createTask equal requires a valid taOrder`: missing, `"A"` (not an array), `[A, A]`, `[A, "nope"]` each → `ValidationError("Pick the TA order for an equal task.")`; `[]` → `"Add TAs on the Team page first."`; order `[A]` with `taCount: 2` → `"This task needs 2 TAs but only 1 is in its order."`.
  - `createTask light ignores taOrder`: light task created with `taOrder: [A]` has no `taOrder` property (`"taOrder" in task` is false).
  - `removeTA refills only the removed TA's seats and shrinks the order`: `A B E A B E`, remove B → names `A A E A E E`, turns on the refilled dates `3` (d2) and `3` (d5), `taOrder` `[A, E]`, the other four occurrences `toBe` the same objects as before.
  - `removeTA shrinks the order of an Equal task even when the TA held no seat`: order `[A, B, E]`, 2 days (A, B); remove E → `taOrder` `[A, B]`, occurrences `toBe` unchanged, no throw.
  - `removeTA is refused when an Equal order would be empty`: order `[E]`, 2 days; remove E → `ValidationError('"Duty" has no TA left to cover its dates.')`.
  - `removeTA is refused when an Equal order becomes too short for taCount`: order `[A, B]`, `taCount: 2`, title `Lab`; remove B → `'"Lab" needs 2 TAs on each date but only 1 is in its order.'`.
  - `removeTA leaves Equal tasks that do not list the TA untouched`: order `[A, B]`; remove E → task `toBe` the same object.
  - `redistributeTask re-deals an Equal task over its order without touching ledgers`: swap d1 (A) with d2 (B), then redistribute → `A B E A B E`; ledgers `toEqual` before.
  - `redistributeAll re-deals Equal tasks and resets only the two ledgers`: one light daily task + the Equal task, swap two Equal seats, redistribute all → Equal order restored, `Object.keys(ledgers)` is `["light","heavy"]`.
  - `updateTask schedule re-deals over the order`: schedule → daily 3 days → `A B E`, fresh ids.
  - `deleteTask equal leaves ledgers unchanged`.
  - `swapping two Equal seats trades them and leaves ledgers unchanged`; `swapping an Equal seat with a light seat throws` `"Only tasks of the same kind can be swapped."`.
  - `reassignOccurrence on an Equal seat moves it without a ledger change`.
  - `setSemester extension continues the rotation by counts`: open-ended weekly Equal task over `[A, B, E]` with 3 dates (A B E); extend the semester end by two weeks → the two new dates are `A` then `B`, turns `2`, `2`; existing occurrences `toBe` unchanged.
  - `describe says Added equal task`: `describe({ type: "createTask", kind: "equal", title: "Duty", schedule, taOrder: [A] }, ws)` → `'Added equal task "Duty"'`.
- [ ] **Step 2: Run** `npx vitest run app/engine/__tests__/reducer-equal.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `dealFor`/`redeal` dispatch on `isLoadKind(task.kind)`: load kinds unchanged; Equal calls `dealEqual({ order: task.taOrder!, occurrences, taCount: task.taCount, held, taskTitle: task.title })` and returns the ledgers untouched. `createTask`: for `kind === "equal"` validate `taOrder` (array of distinct strings all in `ws.tas`), deal with `dealEqual` without `taskTitle`, store `taOrder`; load kinds never store it. `removeTA`: after the load-kind loop, for each Equal task listing the TA: new order, up-front checks via `dealEqual` with the title, refill orphaned occurrences (their seats minus the TA) with `held` = the untouched occurrences, in date order. `setSemester`, `redistributeTask`, `redistributeAll`, `updateTask`: loops over `TASK_KINDS` that index `ledgers` become `LOAD_KINDS`; Equal tasks are (re)dealt through `dealFor`. `deleteTask`, `reassignOccurrence`, `swapOccurrences`: skip the ledger branch when `!isLoadKind(task.kind)`.
- [ ] **Step 4: Run** `npx vitest run app/engine` → PASS (every engine test, including the existing suites).
- [ ] **Step 5: Commit** `feat(engine): equal tasks dealt, refilled and redistributed over their order`.

### Task 3: Document validation and command parsing

**Files:**
- Modify: `app/engine/migrate.ts:68-76` (`isCurrentTask`), `app/server/responses.server.ts:26-40`
- Test: `app/engine/__tests__/migrate.test.ts`, `app/routes/__tests__/api.command.test.ts`

- [ ] **Step 1: Write the failing tests.** In `migrate.test.ts` (inside the `isCurrentWorkspace validates element shapes` block, using its current-document fixture): `accepts an equal task with a non-empty taOrder` (`kind: "equal", taOrder: ["A"]` → `isCurrentWorkspace` true and `upgradeWorkspace` returns the same reference); `rejects an equal task without taOrder` and `with an empty taOrder` (→ false, `upgradeWorkspace` throws `"Unrecognised workspace document."`); `a light task may carry no taOrder` (unchanged behaviour, true). In `api.command.test.ts`: `api.command rejects an equal createTask without a string-array taOrder (400)` for `taOrder` in `[undefined, null, "A", [1]]`; `api.command accepts an equal createTask with taOrder (200)` after adding one TA through the API, asserting the stored task's `taOrder` is `[thatId]`.
- [ ] **Step 2: Run** `npx vitest run app/engine/__tests__/migrate.test.ts app/routes/__tests__/api.command.test.ts` → FAIL.
- [ ] **Step 3: Implement** `isCurrentTask`: when `kind === "equal"`, `taOrder` must be a non-empty array of strings; otherwise as today. `readCommand`: for `createTask` with `kind === "equal"`, `taOrder` must be an array whose every element is a string, else `null`; extend the doc comment.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(server): validate equal tasks in documents and commands`.

### Task 4: Theme, badge, dots, dashboard and settings copy (typecheck green)

**Files:**
- Modify: `app/app.css` (light `:root` after `--heavy`, dark block after `--heavy`, `@theme` after `--color-heavy`), `app/components/ui/Badge.tsx`, `app/components/tasks/KindBadge.tsx`, `app/components/calendar/OccurrencePill.tsx:71-76`, `app/components/dashboard/TurnHeader.tsx`, `app/components/dashboard/TACard.tsx`, `app/components/dashboard/stats.ts`, `app/routes/home.tsx:38-80`, `app/components/layout/SettingsPanel.tsx:152,168`
- Test: `app/components/dashboard/__tests__/stats.test.ts`, `TACard.test.tsx`, `app/components/calendar/__tests__/DayCell.test.tsx`, `app/components/tasks/__tests__/TaskCard.test.tsx`, `app/components/layout/__tests__/SettingsPanel.test.tsx` (if it asserts the body copy)

**Interfaces (produces):**
```ts
// KindBadge.tsx
export const KIND_DOT: Record<TaskKind, string> = { light: "bg-light", heavy: "bg-heavy", equal: "bg-equal" };
// Badge.tsx: BadgeTone gains "equal" → "bg-equal/15 text-equal"
// TurnHeader.tsx: kind: LoadKind; strip class from KIND_DOT[kind]
// stats.ts: TAStats.used: Record<LoadKind, number>; counts: Record<TaskKind, number>
// TACard.tsx: used: Record<LoadKind, number>; counts: Record<TaskKind, number>
```

- [ ] **Step 1: Write the failing tests.** `stats.test.ts`: an Equal task's seats count under `counts.equal` and `used` has only light/heavy keys (`expect(s.A.used).toEqual({ light: 3, heavy: 1 })` stays; add `expect(s.A.counts).toEqual({ light: 3, heavy: 1, equal: 2 })` with an Equal task fixture carrying `taOrder`). `TACard.test.tsx`: caption reads `3 light · 1 heavy · 2 equal` and exactly two gauges render. `TaskCard.test.tsx`: an Equal task renders a badge with text `Equal`. `DayCell.test.tsx`: an Equal task's pill has an element `[data-kind="equal"]` with class `bg-equal`. Update existing fixtures that build `counts` to include `equal: 0`.
- [ ] **Step 2: Run** `npx vitest run app/components/dashboard app/components/calendar app/components/tasks/__tests__/TaskCard.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** CSS: `--equal: #8a5a00;` (light) and `--equal: #f2c26b;` (dark) with the same comment style as `--light`, `--color-equal: var(--equal);`. Badge tone, `KIND_DOT`, pill dot and TurnHeader strip from `KIND_DOT`. `stats.ts`, `TACard`, `home.tsx` iterate `LOAD_KINDS` for ledgers/gauges/tiles, zero `counts` over `TASK_KINDS`; caption `{counts.light} light · {counts.heavy} heavy · {counts.equal} equal`. Settings body (both places): `Deal every task out again from scratch (light, heavy and equal) and reset the fairness counters. Existing assignments will change.`
- [ ] **Step 4: Verify contrast.** Run in node: for each theme, blend `tint = 0.15·equal + 0.85·bg` channel-wise (read `--bg` from `app.css`), compute WCAG contrast between `--equal` and `tint`; both must be ≥ 4.5. Adjust the hex values if not and record the ratio in the CSS comment like the neighbours.
- [ ] **Step 5: Run** `npm run typecheck && npm test` → both PASS (first green point).
- [ ] **Step 6: Commit** `feat(ui): equal badge and dot; dashboard reads load kinds only`.

### Task 5: Tasks page filter and task detail order

**Files:**
- Modify: `app/routes/tasks.tsx:41-64,151-155`, `app/routes/task-detail.tsx:85-96`
- Test: `app/routes/__tests__/tasks.render.test.tsx`, `app/routes/__tests__/task-detail.test.tsx`

- [ ] **Step 1: Write the failing tests.** `tasks.render.test.tsx`: `tasks page filters by ?kind=equal` (chip `Equal` is `aria-pressed="true"`, only Equal cards show); the subtitle reads `2 light · 1 heavy · 1 equal`; `the equal filter with no equal tasks shows the empty state` (`No equal tasks yet`, "Show all tasks" clears the param). `task-detail.test.tsx`: `the detail page lists the order of an equal task` (`getByRole("list", { name: "Order" })` has items in `taOrder` order with the TA names); a light task renders no `Order` list.
- [ ] **Step 2: Run** `npx vitest run app/routes/__tests__/tasks.render.test.tsx app/routes/__tests__/task-detail.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** `FILTERS` gains `{ value: "equal", label: KIND_LABEL.equal }`; counts per kind via `TASK_KINDS`; subtitle `${light} light · ${heavy} heavy · ${equal} equal`; update the comment on `?kind=`. Task detail: under the summary `<p>`, for `task.taOrder` render `<ol aria-label="Order">` of small chips (colour dot + name, missing TA → muted "Removed TA"), separated visually, in order.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run app/routes` → PASS.
- [ ] **Step 5: Commit** `feat(tasks): equal filter chip and order on the detail page`.

### Task 6: Wizard — Equal option and the order list

**Files:**
- Create: `app/components/tasks/TAOrderList.tsx`
- Modify: `app/components/ui/icons.tsx` (add `ChevronUpIcon`, mirroring `ChevronDownIcon`), `app/components/tasks/StepName.tsx`, `app/components/tasks/NewTaskSheet.tsx:48-110,150-162`
- Test: create `app/components/tasks/__tests__/TAOrderList.test.tsx`; modify `StepName.test.tsx`, `NewTaskSheet.test.tsx`

**Interfaces (produces):**
```ts
// TAOrderList.tsx
export function TAOrderList({ tas, order, onChange }: { tas: TA[]; order: string[]; onChange: (order: string[]) => void }): JSX.Element
// renders: ghost Button "Team list order" (disabled when order equals tas ids in order) and <ol aria-label="Order">,
// one <li> per id in `order`: position, colour dot, name, IconButton `Move ${name} up` / `Move ${name} down`
// (first up / last down disabled). With tas.length === 0 renders <p>Add TAs on the Team page first.</p> instead.
// StepName.tsx
type StepNameValue = { kind: TaskKind; title: string; notes: string; taCount: number; taOrder: string[] };
type StepNameProps = StepNameValue & { maxTaCount: number; tas: TA[]; onChange; onSubmit };
/** Reconciles a stored order with the current team: drops unknown ids, appends new TAs in team order. */
export function reconcileOrder(order: string[], tas: TA[]): string[];
```

- [ ] **Step 1: Write the failing tests.**
  - `TAOrderList.test.tsx`: `lists TAs in the given order with positions`; `Move down swaps with the next row` (`onChange` called with the swapped array); `the first up and last down buttons are disabled`; `Team list order resets to team order and is disabled when already matching`; `with no TAs it shows the message and no list`.
  - `StepName.test.tsx`: the first test becomes `StepName offers Light/Heavy/Equal and defaults to light` (radio `Equal` present, `aria-checked="false"`); `choosing Equal shows the equal hint and the order list` (hint text per Global Constraints; `getByRole("list", { name: "Order" })`); `the equal stepper hint` with `maxTaCount: 3` is `Each date is covered by this many TAs together, taken in turn from the order.` and with `1` is `Add more TAs to co-staff dates.`; the `reports kind changes` expectation gains `taOrder`; `reconcileOrder drops unknown ids and appends new TAs` (`reconcileOrder(["B","X"], [A,B,C])` → `["B","A","C"]`).
  - `NewTaskSheet.test.tsx`: `an equal task sends taOrder in team order and caps TAs per date by the team size` (two TAs, one without sections: `aria-valuemax` is `2` after choosing Equal; preview and command bodies match `{ kind: "equal", taOrder: [id1, id2] }`); `a light task sends no taOrder` (`bodies.preview[0]` has no `taOrder` key); `the order sent is reconciled with the current team` (mock `useWorkspace` so the second render drops one TA and adds another; the submitted `taOrder` holds only existing ids with the new one appended); `with no TAs the order list is replaced by the message and Next is disabled` (choose Equal with an empty workspace).
- [ ] **Step 2: Run** `npx vitest run app/components/tasks` → FAIL.
- [ ] **Step 3: Implement.** `ChevronUpIcon`. `TAOrderList` per the interface (buttons are `IconButton`s; rows `min-h-11`; dot uses `ta.color`). `StepName`: `grid-cols-3`, kind hint switches on `kind === "equal"`, stepper hint per kind and cap, `TAOrderList` rendered only for Equal between the kind hint and the stepper. `NewTaskSheet`: state gains `taOrder` initialised to `workspace.tas.map(t => t.id)`; on a kind change to Equal reset it to team order; `maxTaCount = kind === "equal" ? Math.max(1, workspace.tas.length) : Math.max(1, eligibleCount(workspace))`; `command()` adds `taOrder: reconcileOrder(state.taOrder, workspace.tas)` only for Equal; step 0 `valid` also requires `kind !== "equal" || workspace.tas.length > 0`.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run app/components/tasks` → PASS.
- [ ] **Step 5: Commit** `feat(tasks): equal kind in the wizard with a reorderable TA list`.

### Task 7: Preview column for Equal

**Files:**
- Modify: `app/components/tasks/StepPreview.tsx:22-37,96-110`
- Test: `app/components/tasks/__tests__/StepPreview.test.tsx`

- [ ] **Step 1: Write the failing test** `StepPreview lists dates per TA for an equal task`: workspace with TAs A, B (B without sections), an Equal task `taOrder: ["A","B"]` with 3 occurrences A, B, A → heading `After this equal task`; `getByRole("list", { name: "Dates per TA" })` items read `Ahmed · 2 dates` then `Bassem · 1 date`, in order; no gauge (`queryByRole("meter")` / the Gauge's label query returns null).
- [ ] **Step 2: Run** `npx vitest run app/components/tasks/__tests__/StepPreview.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** In the memo, for an Equal task compute `perTa = task.taOrder.map(id => ({ ta: taById.get(id), dates: seats held in this task }))`; render `<ul aria-label="Dates per TA">` with `${name} · ${plural(n, "date", "dates")}` rows (dot + text) in place of the gauge grid; the heading already interpolates the kind.
- [ ] **Step 4: Run** `npm run typecheck && npx vitest run app/components/tasks` → PASS.
- [ ] **Step 5: Commit** `feat(tasks): preview shows dates per TA for equal tasks`.

### Task 8: README and final verification

**Files:**
- Modify: `README.md:13,27-33`

- [ ] **Step 1: Edit the README.** Line 13: `light, heavy or equal (light and heavy each have their own fairness counter; equal goes round the TAs in an order you choose; 1 or more TAs per date)`. After the "TAs per date" section add `### Equal tasks`: one paragraph saying an Equal task ignores sections and deals its dates round-robin over the TA order picked when the task is created (A, B, D, A, B, D), that every TA on the Team page is listed and the order can be reset to the team list, that a second Equal task starts again from its own first TA, that the order is fixed at creation and a TA added later does not join existing Equal tasks, and that removing a TA hands their dates to whoever in the order has the fewest.
- [ ] **Step 2: Run** `npm run typecheck && npm test && npm run build` → all PASS; paste the test summary line into the commit body if the project's history does so, otherwise just confirm.
- [ ] **Step 3: Commit** `docs: README describes equal tasks`.
- [ ] **Step 4: Branch review.** Run `git diff main...HEAD --stat`, confirm no attribution trailers (`git log --format=%B main..HEAD | grep -iE "co-authored|generated with"` prints nothing), then hand the branch to `superpowers:finishing-a-development-branch`.
