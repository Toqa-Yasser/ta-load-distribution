# TA Load Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A no-login web app that registers TAs and sections, creates periodic tasks, and distributes every task occurrence fairly by section-weighted capacity, with full snapshot history, rollback, dark/light theme and motion-rich, touch-friendly UI, deployed on Vercel with data in Supabase.

**Architecture:** A pure TypeScript engine (`app/engine/`) owns all domain logic as `reduce(workspace, command) → workspace`. A thin server layer (`app/server/`) loads/saves the single JSON workspace document through a `Store` interface (Supabase in production, in-memory for tests and local dev), auto-snapshotting before every write. React Router v7 framework-mode routes render the five pages from the root loader and submit commands via fetchers to resource routes.

**Tech Stack:** React 19, React Router 8.4 (framework mode, SSR), Vite 8, Tailwind CSS 4, `motion` 14, `@dnd-kit/core`, `date-fns` 4, `@supabase/supabase-js` 2, Vitest 5 + Testing Library, `@vercel/react-router` preset.

**Spec:** `docs/superpowers/specs/2026-10-16-ta-load-distribution-design.md`

## Global Constraints

- React Router pinned to **8.4.0** (`react-router`, `@react-router/{dev,node,serve}`) — user decision, accepting that `@vercel/react-router@1.3.7` only declares v7 peers (installed with a peer override; if the Vercel build rejects the preset, fall back to Vercel's zero-config React Router path).
- Engine code in `app/engine/` is pure: no I/O, no `Date.now()`/`Math.random()` except through the injected `ReduceContext`.
- Service-role Supabase key is read only in `*.server.ts` files; never imported by client code.
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HISTORY_DELETE_PASSWORD`; plus `DATA_STORE=memory` to run without Supabase.
- Max 500 occurrences per task. Auto snapshots capped at 300; manual snapshots never pruned.
- Capacity counts a section **+1 for each of its two slots** (a TA in both slots gets +2). Turn resets only when every TA with capacity > 0 has `used ≥ capacity`.
- All interactive elements: ≥44px touch targets, `whileHover`/`whileTap` feedback, and every animation disabled under `prefers-reduced-motion`.
- Theme: `data-theme="light"|"dark"` on `<html>`, set before first paint by an inline script; preference stored in `localStorage["theme"]` as `"light" | "dark" | "system"`.
- Dates are ISO `YYYY-MM-DD` strings everywhere in the document; `createdAt` and snapshot `createdAt` are ISO datetime strings.

## Review Focus

1. Blank or whitespace-only TA / section / task names must be rejected with a message, not silently stored (Task 4 `rejects blank names`).
2. Removing the last TA with capacity (or deleting all sections) while tasks exist must leave the workspace unchanged and surface "assign sections first" (Task 4 `removeTA throws NoCapacityError and leaves workspace unchanged`; Task 7 `api.command returns 400 with the error message`).
3. Custom schedules with duplicate or unsorted dates must be normalised (sorted, de-duplicated) so an occurrence is never assigned twice (Task 2 `custom dates are sorted and de-duplicated`).
4. Two people saving in the same second must not lose either change — the version conflict must retry against the newer document (Task 6 `applyCommand retries once on version conflict`).
5. Delete-history with an unset `HISTORY_DELETE_PASSWORD` must always refuse, never "match empty" (Task 6 `deleteHistory refuses when the configured password is empty`).

---

## File Structure

```
app/
  engine/                      pure domain logic (no React, no I/O)
    types.ts                   Workspace, TA, Section, Task, Schedule, Occurrence, Ledger, Command, errors
    rng.ts                     Rng, seededRng, pick
    ids.ts                     newId(prefix)
    empty.ts                   emptyWorkspace()
    capacity.ts                capacities, remainingFraction, turnSize
    schedule.ts                generateDates, customDates
    distribute.ts              assignOccurrences, refund
    reducer.ts                 reduce, describe, ReduceContext, defaultContext
    __tests__/*.test.ts
  server/                      server-only modules
    env.server.ts              read + validate env
    store.ts                   Store interface + row types (no I/O; shared by memory & supabase)
    memory-store.ts            MemoryStore (tests + DATA_STORE=memory)
    supabase-store.server.ts   SupabaseStore
    store.server.ts            getStore() singleton chooser
    workspace.server.ts        loadWorkspace, applyCommand, previewCommand, rollback, saveSnapshot, listSnapshots, deleteHistory
    password.server.ts         checkHistoryPassword
    __tests__/*.test.ts
  lib/                         client-safe helpers
    theme.ts                   ThemePref, resolveTheme, THEME_INIT_SCRIPT, useTheme
    ta-colors.ts               TA_COLORS, nextTaColor
    format.ts                  fmtDate, fmtScheduleSummary
    use-command.ts             useCommand(): submit(command) + pending + lastResult
    use-workspace.ts           useWorkspace(): root loader data
    motion.ts                  spring presets, useReducedMotionSafe
  components/
    ui/                        Button, Card, Gauge, Sheet, ConfirmDialog, Field, Select, Toast, ThemeToggle, EmptyState
    layout/                    AppShell, Header, NavBar (top + bottom tabs), Background, SettingsPanel
    team/                      TAList, TAChip, SectionsBoard, SectionCard, SlotPicker
    tasks/                     TaskCard, NewTaskSheet, StepName, StepSchedule, StepPreview, CustomDatesEditor, SplitBar
    dashboard/                 TACard, TurnHeader, Timeline, SwapSheet
    calendar/                  MonthGrid, DayCell, OccurrencePill, OccurrencePopover
    history/                   SnapshotList, SnapshotRow, PasswordDialog
  routes/
    home.tsx  team.tsx  tasks.tsx  task-detail.tsx  calendar.tsx  history.tsx
    api.command.tsx  api.preview.tsx  api.history.tsx
  routes.ts  root.tsx  app.css  test-setup.ts
supabase/migrations/0001_init.sql
```

---

### Task 1: Engine types, ids, rng, empty workspace, capacity

**Files:**
- Create: `app/engine/types.ts`, `app/engine/rng.ts`, `app/engine/ids.ts`, `app/engine/empty.ts`, `app/engine/capacity.ts`
- Test: `app/engine/__tests__/capacity.test.ts`, `app/engine/__tests__/rng.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type ISODate = string;
  export interface TA { id: string; name: string; color: string }
  export interface Section { id: string; name: string; taIds: [string | null, string | null] }
  export type Schedule =
    | { type: "one-time" | "per-semester"; date: ISODate }
    | { type: "daily" | "weekly" | "monthly"; start: ISODate; end: ISODate | null }
    | { type: "custom"; start: ISODate; count: number; gapDays: number; dates: ISODate[] };
  export interface Occurrence { id: string; date: ISODate; taId: string; turn: number }
  export interface Task { id: string; title: string; notes?: string; createdAt: string; schedule: Schedule; occurrences: Occurrence[] }
  export interface Ledger { turn: number; used: Record<string, number> }
  export interface Semester { name: string; start: ISODate; end: ISODate }
  export interface Workspace { semester: Semester; tas: TA[]; sections: Section[]; tasks: Task[]; ledger: Ledger }
  export type OccurrenceRef = { taskId: string; occurrenceId: string };
  export type Command =
    | { type: "addTA"; name: string }
    | { type: "renameTA"; taId: string; name: string }
    | { type: "removeTA"; taId: string }
    | { type: "addSection"; name: string }
    | { type: "renameSection"; sectionId: string; name: string }
    | { type: "setSectionSlot"; sectionId: string; slot: 0 | 1; taId: string | null }
    | { type: "removeSection"; sectionId: string }
    | { type: "setSemester"; semester: Semester }
    | { type: "createTask"; title: string; notes?: string; schedule: Schedule }
    | { type: "updateTask"; taskId: string; title?: string; notes?: string; schedule?: Schedule }
    | { type: "deleteTask"; taskId: string }
    | { type: "redistributeTask"; taskId: string }
    | { type: "redistributeAll" }
    | { type: "reassignOccurrence"; ref: OccurrenceRef; taId: string }
    | { type: "swapOccurrences"; a: OccurrenceRef; b: OccurrenceRef }
    | { type: "reset" };
  export class EngineError extends Error { constructor(message: string, public code: string) }
  export class NoCapacityError extends EngineError  // code "NO_CAPACITY", message "Assign sections to at least one TA first."
  export class ValidationError extends EngineError  // code "VALIDATION"
  export class TooManyOccurrencesError extends EngineError // code "TOO_MANY", message "This schedule creates more than 500 occurrences."
  ```
- Produces (`rng.ts`): `export type Rng = () => number` (in [0,1)); `export function seededRng(seed: number): Rng` (mulberry32); `export function pick<T>(items: T[], rng: Rng): T`.
- Produces (`ids.ts`): `export function newId(prefix: string): string` → `${prefix}_${nanoid(8)}`.
- Produces (`empty.ts`): `export function emptyWorkspace(): Workspace` → `{ semester: { name: "Semester", start: "2026-09-01", end: "2027-01-31" }, tas: [], sections: [], tasks: [], ledger: { turn: 1, used: {} } }`.
- Produces (`capacity.ts`): `export function capacities(ws: Workspace): Record<string, number>` (every TA id present, 0 if none); `export function turnSize(ws: Workspace): number`; `export function remainingFraction(capacity: number, used: number): number` (`(capacity - used) / capacity`; capacity 0 → `-Infinity`).

- [ ] **Step 1: Write failing capacity tests**

```ts
// app/engine/__tests__/capacity.test.ts
import { capacities, turnSize, remainingFraction } from "~/engine/capacity";
import { emptyWorkspace } from "~/engine/empty";

const ws = { ...emptyWorkspace(),
  tas: [{ id: "A", name: "A", color: "#000" }, { id: "B", name: "B", color: "#000" }, { id: "Z", name: "Z", color: "#000" }],
  sections: [
    { id: "s1", name: "S1", taIds: ["A", "B"] as [string, string] },
    { id: "s2", name: "S2", taIds: ["B", "B"] as [string, string] },
    { id: "s3", name: "S3", taIds: [null, null] as [null, null] },
  ] };

test("a section counts +1 for each slot, a TA in both slots gets +2", () => {
  expect(capacities(ws)).toEqual({ A: 1, B: 3, Z: 0 });
});
test("turnSize is the sum of capacities", () => { expect(turnSize(ws)).toBe(4); });
test("remainingFraction", () => {
  expect(remainingFraction(3, 1)).toBeCloseTo(2 / 3);
  expect(remainingFraction(0, 0)).toBe(-Infinity);
});
```

```ts
// app/engine/__tests__/rng.test.ts
import { seededRng, pick } from "~/engine/rng";
test("seededRng is deterministic and in [0,1)", () => {
  const a = seededRng(42), b = seededRng(42);
  const xs = [a(), a(), a()];
  expect(xs).toEqual([b(), b(), b()]);
  for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
});
test("pick returns first item when rng is 0 and last when rng → 1", () => {
  expect(pick(["x", "y", "z"], () => 0)).toBe("x");
  expect(pick(["x", "y", "z"], () => 0.999)).toBe("z");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/engine`
Expected: FAIL — cannot resolve `~/engine/capacity`, `~/engine/rng`.

- [ ] **Step 3: Implement `types.ts`, `rng.ts`, `ids.ts`, `empty.ts`, `capacity.ts` per the Interfaces block**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/engine`
Expected: PASS 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/engine
git commit -m "feat(engine): types, rng, ids, empty workspace, capacity"
```

---

### Task 2: Schedule → dates

**Files:**
- Create: `app/engine/schedule.ts`
- Test: `app/engine/__tests__/schedule.test.ts`

**Interfaces:**
- Consumes: `Schedule`, `Semester`, `TooManyOccurrencesError` from Task 1.
- Produces: `export function generateDates(schedule: Schedule, semester: Semester): ISODate[]` (sorted ascending, unique); `export function customDates(start: ISODate, count: number, gapDays: number): ISODate[]`.
- Semantics: one-time / per-semester → `[date]`. daily/weekly/monthly → start, start+step, … while `<= (schedule.end ?? semester.end)`; step via date-fns `addDays(1)` / `addWeeks(1)` / `addMonths(1)` (month-end clamps). If start > end → `[]`. custom → `schedule.dates` sorted + de-duplicated. Throw `TooManyOccurrencesError` if result length > 500. Parse/format with date-fns `parseISO` / `format(d, "yyyy-MM-dd")`.

- [ ] **Step 1: Write failing tests**

```ts
import { generateDates, customDates } from "~/engine/schedule";
import { TooManyOccurrencesError } from "~/engine/types";
const sem = { name: "F26", start: "2026-09-01", end: "2026-12-31" };

test("one-time and per-semester yield the single date", () => {
  expect(generateDates({ type: "one-time", date: "2026-10-05" }, sem)).toEqual(["2026-10-05"]);
  expect(generateDates({ type: "per-semester", date: "2026-12-20" }, sem)).toEqual(["2026-12-20"]);
});
test("weekly with explicit end is inclusive", () => {
  expect(generateDates({ type: "weekly", start: "2026-10-01", end: "2026-10-22" }, sem))
    .toEqual(["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"]);
});
test("daily with end=null runs to semester end", () => {
  const ds = generateDates({ type: "daily", start: "2026-12-29", end: null }, sem);
  expect(ds).toEqual(["2026-12-29", "2026-12-30", "2026-12-31"]);
});
test("monthly clamps the day of month", () => {
  expect(generateDates({ type: "monthly", start: "2026-08-31", end: "2026-11-30" }, sem))
    .toEqual(["2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30"]);
});
test("start after end yields nothing", () => {
  expect(generateDates({ type: "weekly", start: "2027-01-05", end: null }, sem)).toEqual([]);
});
test("custom dates are sorted and de-duplicated", () => {
  expect(generateDates({ type: "custom", start: "2026-10-01", count: 3, gapDays: 5,
    dates: ["2026-10-11", "2026-10-01", "2026-10-11", "2026-10-06"] }, sem))
    .toEqual(["2026-10-01", "2026-10-06", "2026-10-11"]);
});
test("customDates generates start + i*gap", () => {
  expect(customDates("2026-10-01", 3, 10)).toEqual(["2026-10-01", "2026-10-11", "2026-10-21"]);
});
test("more than 500 occurrences throws", () => {
  expect(() => generateDates({ type: "daily", start: "2020-01-01", end: "2026-12-31" }, sem)).toThrow(TooManyOccurrencesError);
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/engine/__tests__/schedule.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `schedule.ts`**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run app/engine` — Expected: PASS 13 tests.
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): schedule date generation"` (after `git add app/engine`).

---

### Task 3: Distribution — assign & refund

**Files:**
- Create: `app/engine/distribute.ts`
- Test: `app/engine/__tests__/distribute.test.ts`

**Interfaces:**
- Consumes: `Ledger`, `Occurrence`, `NoCapacityError`, `Rng`, `pick`, `remainingFraction`.
- Produces:
  ```ts
  export interface PendingOccurrence { id: string; date: ISODate }
  export function assignOccurrences(args: {
    capacities: Record<string, number>; ledger: Ledger; occurrences: PendingOccurrence[]; rng: Rng;
  }): { ledger: Ledger; occurrences: Occurrence[] }   // pure; input ledger not mutated
  export function refund(ledger: Ledger, occurrences: Occurrence[]): Ledger
    // for each occ with occ.turn === ledger.turn: used[taId] = max(0, used-1)
  ```
- Algorithm (spec A2): process occurrences sorted by date (stable). eligible = TA ids with capacity > 0 → none → throw `NoCapacityError`. If every eligible has `used ≥ capacity` → `turn + 1`, `used = {}`. Choose max `remainingFraction(cap, used ?? 0)`; ties (equal within 1e-9) → `pick(ties, rng)`. Increment used; emit `{...occ, taId, turn}`.

- [ ] **Step 1: Write failing tests**

```ts
import { assignOccurrences, refund } from "~/engine/distribute";
import { NoCapacityError } from "~/engine/types";
import { seededRng } from "~/engine/rng";
const caps = { A: 1, B: 2, C: 2, D: 3 };
const occ = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: `o${from + i}`, date: `2026-10-${String(from + i).padStart(2, "0")}` }));
const count = (occs: { taId: string }[]) => occs.reduce((m, o) => ({ ...m, [o.taId]: (m[o.taId] ?? 0) + 1 }), {} as Record<string, number>);

test("first full turn hands out exactly the capacities", () => {
  const r = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(8), rng: seededRng(1) });
  expect(count(r.occurrences)).toEqual({ A: 1, B: 2, C: 2, D: 3 });
  expect(r.ledger).toEqual({ turn: 1, used: { A: 1, B: 2, C: 2, D: 3 } });
});
test("reference scenario: 10 then ledger A1 B1 → 4 goes C1 D2 and B-or-C 1", () => {
  const ten = assignOccurrences({ capacities: caps, ledger: { turn: 1, used: {} }, occurrences: occ(10), rng: seededRng(7) });
  expect(ten.ledger.turn).toBe(2);
  expect(Object.values(ten.ledger.used).sort()).toEqual([1, 1]);           // two distinct TAs got the remainder
  expect(ten.occurrences.slice(0, 8).every(o => o.turn === 1)).toBe(true);
  expect(ten.occurrences.slice(8).every(o => o.turn === 2)).toBe(true);

  const four = assignOccurrences({ capacities: caps, ledger: { turn: 2, used: { A: 1, B: 1 } }, occurrences: occ(4, 11), rng: seededRng(3) });
  const c = count(four.occurrences);
  expect(c.A).toBeUndefined();
  expect(c.D).toBe(2);
  expect((c.B ?? 0) + (c.C ?? 0)).toBe(2);
  expect(c.C).toBeGreaterThanOrEqual(1);
});
test("ties are broken by rng (rng=0 → first eligible in id order)", () => {
  const r = assignOccurrences({ capacities: { A: 1, B: 1 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), rng: () => 0 });
  expect(r.occurrences[0].taId).toBe("A");
});
test("a TA with capacity 0 is never picked", () => {
  const r = assignOccurrences({ capacities: { A: 0, B: 1 }, ledger: { turn: 1, used: {} }, occurrences: occ(3), rng: seededRng(1) });
  expect(r.occurrences.every(o => o.taId === "B")).toBe(true);
  expect(r.ledger.turn).toBe(3);
});
test("no capacity anywhere throws NoCapacityError", () => {
  expect(() => assignOccurrences({ capacities: { A: 0 }, ledger: { turn: 1, used: {} }, occurrences: occ(1), rng: seededRng(1) })).toThrow(NoCapacityError);
});
test("input ledger is not mutated", () => {
  const ledger = { turn: 1, used: {} };
  assignOccurrences({ capacities: caps, ledger, occurrences: occ(3), rng: seededRng(1) });
  expect(ledger).toEqual({ turn: 1, used: {} });
});
test("refund only returns units from the current turn and floors at 0", () => {
  const ledger = { turn: 2, used: { A: 1, B: 0 } };
  const out = refund(ledger, [
    { id: "x", date: "2026-10-01", taId: "A", turn: 2 },
    { id: "y", date: "2026-10-02", taId: "A", turn: 1 },
    { id: "z", date: "2026-10-03", taId: "B", turn: 2 },
  ]);
  expect(out).toEqual({ turn: 2, used: { A: 0, B: 0 } });
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/engine/__tests__/distribute.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `distribute.ts`**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run app/engine` — Expected: PASS 20 tests.
- [ ] **Step 5: Commit** — `git add app/engine && git commit -m "feat(engine): weighted assignment with turn ledger"`.

---

### Task 4: Reducer — team, semester, createTask, reset, describe

**Files:**
- Create: `app/engine/reducer.ts`
- Test: `app/engine/__tests__/reducer-team.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces:
  ```ts
  export interface ReduceContext { rng: Rng; now: () => string; newId: (prefix: string) => string }
  export function defaultContext(): ReduceContext      // Math.random, new Date().toISOString(), ids.newId
  export function testContext(seed = 1): ReduceContext // seededRng(seed), fixed now "2026-10-16T12:00:00.000Z", counter ids `${prefix}_${n}`
  export function reduce(ws: Workspace, cmd: Command, ctx: ReduceContext): Workspace  // never mutates ws
  export function describe(cmd: Command, ws: Workspace): string   // label for auto-snapshots, uses ws to resolve names
  ```
- Rules this task implements: `addTA` (trim; blank → `ValidationError("Name is required.")`; color via `nextTaColor` from `app/lib/ta-colors.ts` — create that file here: `TA_COLORS: string[]` of 10 hex colours, `nextTaColor(existing: TA[]): string` = least-used colour, first on ties), `renameTA`, `removeTA` (remove from `tas`, null its section slots, delete its ledger entry; its occurrences: refund then `assignOccurrences` using new capacities — if none, `NoCapacityError`), `addSection` (name required), `renameSection`, `setSectionSlot`, `removeSection`, `setSemester` (`end < start` → ValidationError; occurrences with `date > end` are refunded and removed), `createTask` (title required; `generateDates` → pending occurrences `{ id: newId("occ"), date }` → `assignOccurrences`; `createdAt = ctx.now()`; empty date list → `ValidationError("This schedule has no dates.")`), `reset` → `emptyWorkspace()`. Unknown TA/section/task id → `ValidationError`.
- `describe` labels (exact copy): `Added TA "Ahmed"`, `Renamed TA to "Ahmed"`, `Removed TA "Ahmed"`, `Added section "S1"`, `Renamed section to "S1"`, `Assigned Ahmed to S1`, `Cleared a slot in S1`, `Removed section "S1"`, `Updated semester`, `Added task "Grade quiz"`, `Updated task "Grade quiz"`, `Deleted task "Grade quiz"`, `Redistributed "Grade quiz"`, `Redistributed everything`, `Reassigned Oct 20 to Dina`, `Swapped Ahmed ↔ Dina`, `Reset everything`.

- [ ] **Step 1: Write failing tests**

```ts
import { reduce, describe as describeCmd, testContext } from "~/engine/reducer";
import { emptyWorkspace } from "~/engine/empty";
import { capacities } from "~/engine/capacity";
import { ValidationError, NoCapacityError } from "~/engine/types";
const ctx = testContext();
const run = (cmds: Command[], ws = emptyWorkspace()) => cmds.reduce((w, c) => reduce(w, c, ctx), ws);

test("addTA assigns distinct colours and trims the name", () => {
  const ws = run([{ type: "addTA", name: "  Ahmed " }, { type: "addTA", name: "Basma" }]);
  expect(ws.tas.map(t => t.name)).toEqual(["Ahmed", "Basma"]);
  expect(ws.tas[0].color).not.toBe(ws.tas[1].color);
});
test("rejects blank names", () => {
  expect(() => run([{ type: "addTA", name: "   " }])).toThrow(ValidationError);
  expect(() => run([{ type: "addSection", name: "" }])).toThrow(ValidationError);
  expect(() => run([{ type: "addTA", name: "A" }, { type: "createTask", title: " ", schedule: { type: "one-time", date: "2026-10-01" } }])).toThrow(ValidationError);
});
test("sections slots drive capacity", () => {
  const ws = run([{ type: "addTA", name: "A" }, { type: "addSection", name: "S1" }]);
  const [ta] = ws.tas; const [sec] = ws.sections;
  const ws2 = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 0, taId: ta.id }, ctx);
  expect(capacities(ws2)[ta.id]).toBe(1);
  expect(capacities(reduce(ws2, { type: "removeSection", sectionId: sec.id }, ctx))[ta.id]).toBe(0);
});
function team() {   // A1 B2 C2 D3 via 4 sections
  let ws = run([..."ABCD"].map(n => ({ type: "addTA", name: n }) as Command));
  const id = (n: string) => ws.tas.find(t => t.name === n)!.id;
  const pairs: [string, string][] = [["A", "B"], ["B", "C"], ["C", "D"], ["D", "D"]];
  pairs.forEach((p, i) => {
    ws = reduce(ws, { type: "addSection", name: `S${i + 1}` }, ctx);
    const sec = ws.sections[i];
    ws = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 0, taId: id(p[0]) }, ctx);
    ws = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 1, taId: id(p[1]) }, ctx);
  });
  return { ws, id };
}
test("createTask generates and assigns occurrences, advancing the ledger", () => {
  const { ws } = team();
  const out = reduce(ws, { type: "createTask", title: "Quiz", schedule: { type: "weekly", start: "2026-10-01", end: "2026-10-22" } }, ctx);
  expect(out.tasks[0].occurrences).toHaveLength(4);
  expect(out.tasks[0].createdAt).toBe("2026-10-16T12:00:00.000Z");
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(4);
});
test("createTask with no sections throws NoCapacityError", () => {
  const ws = run([{ type: "addTA", name: "A" }]);
  expect(() => reduce(ws, { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } }, ctx)).toThrow(NoCapacityError);
});
test("removeTA re-assigns its occurrences to the others", () => {
  const { ws, id } = team();
  const withTask = reduce(ws, { type: "createTask", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: "2026-10-08" } }, ctx);
  const out = reduce(withTask, { type: "removeTA", taId: id("D") }, ctx);
  expect(out.tas.map(t => t.name)).toEqual(["A", "B", "C"]);
  expect(out.sections.every(s => !s.taIds.includes(id("D")))).toBe(true);
  expect(out.tasks[0].occurrences).toHaveLength(8);
  expect(out.tasks[0].occurrences.every(o => o.taId !== id("D"))).toBe(true);
  expect(out.ledger.used[id("D")]).toBeUndefined();
});
test("removeTA throws NoCapacityError and leaves workspace unchanged when nobody else has capacity", () => {
  const ws0 = run([{ type: "addTA", name: "A" }, { type: "addTA", name: "B" }, { type: "addSection", name: "S" }]);
  const ws = reduce(ws0, { type: "setSectionSlot", sectionId: ws0.sections[0].id, slot: 0, taId: ws0.tas[0].id }, ctx);
  const withTask = reduce(ws, { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } }, ctx);
  expect(() => reduce(withTask, { type: "removeTA", taId: ws.tas[0].id }, ctx)).toThrow(NoCapacityError);
});
test("setSemester with end before start is rejected; shrinking end truncates occurrences", () => {
  const { ws } = team();
  expect(() => reduce(ws, { type: "setSemester", semester: { name: "x", start: "2026-10-10", end: "2026-10-01" } }, ctx)).toThrow(ValidationError);
  const t = reduce(ws, { type: "createTask", title: "Q", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  const cut = reduce(t, { type: "setSemester", semester: { ...t.semester, end: "2026-10-20" } }, ctx);
  expect(cut.tasks[0].occurrences.map(o => o.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
});
test("reset returns the empty workspace", () => {
  const { ws } = team();
  expect(reduce(ws, { type: "reset" }, ctx)).toEqual(emptyWorkspace());
});
test("reduce never mutates its input", () => {
  const ws = emptyWorkspace(); const frozen = JSON.stringify(ws);
  reduce(ws, { type: "addTA", name: "A" }, ctx);
  expect(JSON.stringify(ws)).toBe(frozen);
});
test("describe produces human labels", () => {
  const ws = run([{ type: "addTA", name: "Ahmed" }]);
  expect(describeCmd({ type: "addTA", name: "Ahmed" }, ws)).toBe('Added TA "Ahmed"');
  expect(describeCmd({ type: "removeTA", taId: ws.tas[0].id }, ws)).toBe('Removed TA "Ahmed"');
  expect(describeCmd({ type: "reset" }, ws)).toBe("Reset everything");
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/engine/__tests__/reducer-team.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `app/lib/ta-colors.ts` and `app/engine/reducer.ts` (these commands only; others throw `ValidationError("Not implemented")` for now)**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run app/engine` — Expected: PASS 32 tests.
- [ ] **Step 5: Commit** — `git add app/engine app/lib && git commit -m "feat(engine): reducer for team, semester, task creation, reset"`.

---

### Task 5: Reducer — task mutations, redistribute, reassign, swap

**Files:**
- Modify: `app/engine/reducer.ts`
- Test: `app/engine/__tests__/reducer-tasks.test.ts`

**Interfaces:**
- Consumes: `reduce`, `testContext`, `team()` helper (copy it into a shared `app/engine/__tests__/fixtures.ts` and import from both reducer test files).
- Rules: `deleteTask` → `refund` then remove. `updateTask` → title/notes in place; if `schedule` given → refund old occurrences, regenerate, assign. `redistributeTask` → refund, re-assign same dates (new ids not required; keep ids). `redistributeAll` → `ledger = {turn: 1, used: {}}`, then for each task in `createdAt` order (stable by array order on ties) re-assign its existing occurrences. `reassignOccurrence` → if `occ.turn === ledger.turn` decrement old (floor 0); increment new; `occ.turn = ledger.turn`; same TA → no-op. `swapOccurrences` → exchange `taId`s, ledger untouched; same ref → ValidationError.

- [ ] **Step 1: Write failing tests**

```ts
import { reduce, testContext } from "~/engine/reducer";
import { team } from "./fixtures";
import { ValidationError } from "~/engine/types";
const ctx = testContext();
const quiz = (ws, n = 8) => reduce(ws, { type: "createTask", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: `2026-10-${String(n).padStart(2, "0")}` } }, ctx);

test("deleteTask refunds only current-turn units", () => {
  const { ws } = team();
  const t1 = quiz(ws, 10);                       // 8 in turn 1, 2 in turn 2
  const t2 = reduce(t1, { type: "createTask", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t2, { type: "deleteTask", taskId: t1.tasks[0].id }, ctx);
  expect(out.tasks.map(t => t.title)).toEqual(["Lab"]);
  const labTa = t2.tasks[1].occurrences[0].taId;
  expect(out.ledger.turn).toBe(2);
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(1);   // only Lab's unit remains
  expect(out.ledger.used[labTa]).toBe(1);
});
test("redistributeTask keeps dates and ids but may change TAs; ledger totals unchanged", () => {
  const { ws } = team();
  const t = quiz(ws, 5);
  const out = reduce(t, { type: "redistributeTask", taskId: t.tasks[0].id }, ctx);
  expect(out.tasks[0].occurrences.map(o => o.id)).toEqual(t.tasks[0].occurrences.map(o => o.id));
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(5);
});
test("redistributeAll resets the ledger and re-deals in creation order", () => {
  const { ws } = team();
  const t = reduce(quiz(ws, 10), { type: "createTask", title: "Lab", schedule: { type: "one-time", date: "2026-11-01" } }, ctx);
  const out = reduce(t, { type: "redistributeAll" }, ctx);
  expect(out.ledger.turn).toBe(2);
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(3);  // 11 units = 8 (turn 1) + 3
  expect(out.tasks[0].occurrences.slice(0, 8).every(o => o.turn === 1)).toBe(true);
});
test("updateTask with a new schedule refunds and regenerates", () => {
  const { ws } = team();
  const t = quiz(ws, 3);
  const out = reduce(t, { type: "updateTask", taskId: t.tasks[0].id, title: "Quiz 2", schedule: { type: "one-time", date: "2026-12-01" } }, ctx);
  expect(out.tasks[0].title).toBe("Quiz 2");
  expect(out.tasks[0].occurrences.map(o => o.date)).toEqual(["2026-12-01"]);
  expect(Object.values(out.ledger.used).reduce((a, b) => a + b, 0)).toBe(1);
});
test("reassignOccurrence moves one unit between TAs", () => {
  const { ws, id } = team();
  const t = quiz(ws, 1);
  const occ = t.tasks[0].occurrences[0];
  const target = occ.taId === id("A") ? id("B") : id("A");
  const out = reduce(t, { type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: occ.id }, taId: target }, ctx);
  expect(out.tasks[0].occurrences[0].taId).toBe(target);
  expect(out.ledger.used[occ.taId] ?? 0).toBe(0);
  expect(out.ledger.used[target]).toBe(1);
});
test("swapOccurrences trades TAs and leaves the ledger alone", () => {
  const { ws } = team();
  const t = quiz(ws, 8);
  const [a, b] = t.tasks[0].occurrences.filter((o, i, arr) => o.taId !== arr[0].taId || i === 0).slice(0, 2);
  const ref = (o) => ({ taskId: t.tasks[0].id, occurrenceId: o.id });
  const out = reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(b) }, ctx);
  const find = (id) => out.tasks[0].occurrences.find(o => o.id === id)!;
  expect(find(a.id).taId).toBe(b.taId);
  expect(find(b.id).taId).toBe(a.taId);
  expect(out.ledger).toEqual(t.ledger);
  expect(() => reduce(t, { type: "swapOccurrences", a: ref(a), b: ref(a) }, ctx)).toThrow(ValidationError);
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/engine/__tests__/reducer-tasks.test.ts` — Expected: FAIL with `ValidationError: Not implemented`.
- [ ] **Step 3: Implement the remaining commands in `reducer.ts`; move `team()` into `fixtures.ts`**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run app/engine` — Expected: PASS 38 tests.
- [ ] **Step 5: Commit** — `git add app/engine && git commit -m "feat(engine): task mutations, redistribute, reassign, swap"`.

---

### Task 6: Persistence — Store interface, MemoryStore, workspace service, Supabase store, migration

**Files:**
- Create: `app/server/store.ts`, `app/server/memory-store.ts`, `app/server/workspace.server.ts`, `app/server/password.server.ts`, `app/server/env.server.ts`, `app/server/supabase-store.server.ts`, `app/server/store.server.ts`, `supabase/migrations/0001_init.sql`
- Test: `app/server/__tests__/workspace.test.ts`, `app/server/__tests__/password.test.ts`

**Interfaces:**
- Produces (`store.ts`):
  ```ts
  export interface WorkspaceRow { data: Workspace; version: number }
  export interface SnapshotMeta { id: number; name: string | null; label: string; kind: "auto" | "manual"; version: number; createdAt: string }
  export interface Store {
    getWorkspace(): Promise<WorkspaceRow | null>;
    putWorkspace(data: Workspace, expectedVersion: number | null): Promise<boolean>; // null = create (version 1); false on conflict
    insertSnapshot(s: Omit<SnapshotMeta, "id" | "createdAt"> & { data: Workspace }): Promise<number>;
    listSnapshots(): Promise<SnapshotMeta[]>;      // newest first
    getSnapshot(id: number): Promise<(SnapshotMeta & { data: Workspace }) | null>;
    pruneAutoSnapshots(keep: number): Promise<void>;
    deleteAllSnapshots(): Promise<void>;
  }
  ```
- Produces (`memory-store.ts`): `export class MemoryStore implements Store { constructor(opts?: { beforePut?: (store: MemoryStore) => void }) }` — `beforePut` runs once before each `putWorkspace` (test hook for conflicts).
- Produces (`workspace.server.ts`):
  ```ts
  export const AUTO_SNAPSHOT_KEEP = 300;
  export async function loadWorkspace(store: Store): Promise<WorkspaceRow>  // creates emptyWorkspace() at version 1 if missing
  export async function applyCommand(store: Store, cmd: Command, ctx = defaultContext()): Promise<{ workspace: Workspace; version: number; snapshotId: number }>
    // loop ≤3: load → reduce → insertSnapshot(auto, label=describe(cmd, old), data=old, version=old.version) → putWorkspace(new, old.version); on conflict retry; after success pruneAutoSnapshots(300). Engine errors propagate untouched. Three conflicts → throw EngineError("Someone else saved at the same time. Please retry.", "CONFLICT").
  export async function previewCommand(store: Store, cmd: Command, ctx = defaultContext()): Promise<Workspace>   // reduce without saving
  export async function rollback(store: Store, snapshotId: number): Promise<{ workspace: Workspace; version: number; snapshotId: number }>  // auto-snapshot current with label `Rolled back to "<name or label>"`, then put snapshot.data
  export async function saveSnapshot(store: Store, name: string): Promise<number>   // kind manual, label `Snapshot "<name>"`; blank name → ValidationError
  export const listSnapshots = (store: Store) => store.listSnapshots();
  export async function deleteHistory(store: Store, password: string, configured: string | undefined): Promise<boolean>  // uses checkHistoryPassword; true if deleted
  ```
- Produces (`password.server.ts`): `export function checkHistoryPassword(given: string, configured: string | undefined): boolean` — false if `configured` is empty/undefined; constant-time compare via `crypto.timingSafeEqual` on equal-length buffers (length mismatch → false).
- Produces (`env.server.ts`): `export function getEnv(): { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string; HISTORY_DELETE_PASSWORD?: string; DATA_STORE: "supabase" | "memory" }` — `DATA_STORE` defaults to `"memory"` when `SUPABASE_URL` is unset, else `"supabase"`.
- Produces (`store.server.ts`): `export function getStore(): Store` — module-level singleton (MemoryStore kept on `globalThis.__memStore` so dev HMR keeps data).
- Produces (`supabase-store.server.ts`): `export class SupabaseStore implements Store { constructor(url: string, serviceKey: string) }` — `putWorkspace`: when `expectedVersion === null` insert `{id:1, data, version:1}` (ignore duplicate → return false); else `update ... .eq("id",1).eq("version", expected).select("version")` → `data.length === 1`. `pruneAutoSnapshots`: select auto ids newest-first, delete those after index `keep`.
- Migration SQL (exact):
  ```sql
  create table if not exists workspace (
    id int primary key check (id = 1),
    data jsonb not null,
    version int not null default 1,
    updated_at timestamptz not null default now()
  );
  create table if not exists snapshots (
    id bigserial primary key,
    name text,
    label text not null,
    kind text not null check (kind in ('auto','manual')),
    data jsonb not null,
    version int not null,
    created_at timestamptz not null default now()
  );
  create index if not exists snapshots_created_at_idx on snapshots (created_at desc);
  alter table workspace enable row level security;
  alter table snapshots enable row level security;
  ```

- [ ] **Step 1: Write failing tests**

```ts
// app/server/__tests__/workspace.test.ts
import { MemoryStore } from "~/server/memory-store";
import { applyCommand, loadWorkspace, previewCommand, rollback, saveSnapshot, deleteHistory, AUTO_SNAPSHOT_KEEP } from "~/server/workspace.server";
import { testContext } from "~/engine/reducer";
import { EngineError } from "~/engine/types";

test("loadWorkspace creates an empty workspace at version 1", async () => {
  const store = new MemoryStore();
  expect(await loadWorkspace(store)).toMatchObject({ version: 1, data: { tas: [] } });
});
test("applyCommand saves, bumps the version and writes an auto snapshot of the previous state", async () => {
  const store = new MemoryStore();
  const r = await applyCommand(store, { type: "addTA", name: "Ahmed" }, testContext());
  expect(r.version).toBe(2);
  expect(r.workspace.tas[0].name).toBe("Ahmed");
  const snaps = await store.listSnapshots();
  expect(snaps).toHaveLength(1);
  expect(snaps[0]).toMatchObject({ kind: "auto", label: 'Added TA "Ahmed"', version: 1 });
  expect((await store.getSnapshot(snaps[0].id))!.data.tas).toEqual([]);
});
test("applyCommand retries once on version conflict", async () => {
  let fired = false;
  const store = new MemoryStore({ beforePut: async (s) => { if (!fired) { fired = true; await s.putWorkspace({ ...(await s.getWorkspace())!.data, semester: { name: "X", start: "2026-01-01", end: "2026-12-31" } }, 1); } } });
  const r = await applyCommand(store, { type: "addTA", name: "Ahmed" }, testContext());
  expect(r.version).toBe(3);
  expect(r.workspace.semester.name).toBe("X");       // built on the newer document
  expect(r.workspace.tas[0].name).toBe("Ahmed");
});
test("applyCommand gives up after three conflicts", async () => {
  const store = new MemoryStore({ beforePut: async (s) => { const w = (await s.getWorkspace())!; await s.putWorkspace(w.data, w.version); } });
  await expect(applyCommand(store, { type: "addTA", name: "A" }, testContext())).rejects.toMatchObject({ code: "CONFLICT" });
});
test("engine errors propagate and nothing is saved", async () => {
  const store = new MemoryStore();
  await expect(applyCommand(store, { type: "addTA", name: " " }, testContext())).rejects.toBeInstanceOf(EngineError);
  expect(await store.listSnapshots()).toHaveLength(0);
});
test("previewCommand does not save", async () => {
  const store = new MemoryStore();
  const ws = await previewCommand(store, { type: "addTA", name: "A" }, testContext());
  expect(ws.tas).toHaveLength(1);
  expect((await loadWorkspace(store)).data.tas).toHaveLength(0);
});
test("rollback restores a snapshot and records the rollback itself", async () => {
  const store = new MemoryStore();
  await applyCommand(store, { type: "addTA", name: "A" }, testContext());
  const [snap] = await store.listSnapshots();
  const r = await rollback(store, snap.id);
  expect(r.workspace.tas).toEqual([]);
  expect((await store.listSnapshots())[0].label).toBe('Rolled back to "Added TA \"A\""');
});
test("saveSnapshot stores a manual snapshot with the name", async () => {
  const store = new MemoryStore();
  const id = await saveSnapshot(store, "Before exam");
  expect((await store.getSnapshot(id))).toMatchObject({ kind: "manual", name: "Before exam" });
});
test("auto snapshots are pruned to AUTO_SNAPSHOT_KEEP, manual ones kept", async () => {
  const store = new MemoryStore();
  await saveSnapshot(store, "keep me");
  for (let i = 0; i < AUTO_SNAPSHOT_KEEP + 5; i++) await applyCommand(store, { type: "addTA", name: `T${i}` }, testContext());
  const snaps = await store.listSnapshots();
  expect(snaps.filter(s => s.kind === "auto")).toHaveLength(AUTO_SNAPSHOT_KEEP);
  expect(snaps.filter(s => s.kind === "manual")).toHaveLength(1);
});
test("deleteHistory requires the configured password", async () => {
  const store = new MemoryStore();
  await applyCommand(store, { type: "addTA", name: "A" }, testContext());
  expect(await deleteHistory(store, "nope", "secret")).toBe(false);
  expect(await store.listSnapshots()).toHaveLength(1);
  expect(await deleteHistory(store, "secret", "secret")).toBe(true);
  expect(await store.listSnapshots()).toHaveLength(0);
});
```
```ts
// app/server/__tests__/password.test.ts
import { checkHistoryPassword } from "~/server/password.server";
test("deleteHistory refuses when the configured password is empty", () => {
  expect(checkHistoryPassword("", "")).toBe(false);
  expect(checkHistoryPassword("", undefined)).toBe(false);
});
test("matches only the exact password", () => {
  expect(checkHistoryPassword("abc", "abc")).toBe(true);
  expect(checkHistoryPassword("abcd", "abc")).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/server` — Expected: FAIL, modules not found.
- [ ] **Step 3: Implement `store.ts`, `memory-store.ts`, `password.server.ts`, `workspace.server.ts`**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 50 tests.
- [ ] **Step 5: Implement `env.server.ts`, `supabase-store.server.ts`, `store.server.ts`, and write `supabase/migrations/0001_init.sql`** (no unit test; verified live in Task 14).
- [ ] **Step 6: Typecheck** — Run: `npm run typecheck` — Expected: exit 0.
- [ ] **Step 7: Commit** — `git add app/server supabase && git commit -m "feat(server): store abstraction, workspace service, supabase store, migration"`.

---

### Task 7: App shell — theme, root loader, resource routes, command hook, navigation

**Files:**
- Modify: `app/app.css`, `app/root.tsx`, `app/routes.ts`
- Create: `app/lib/theme.ts`, `app/lib/use-workspace.ts`, `app/lib/use-command.ts`, `app/lib/motion.ts`, `app/lib/format.ts`, `app/components/layout/{AppShell,Header,NavBar,Background}.tsx`, `app/components/ui/{Button,ThemeToggle,Toast}.tsx`, `app/routes/{home,team,tasks,task-detail,calendar,history}.tsx` (stubs: heading only), `app/routes/{api.command,api.preview,api.history}.tsx`
- Test: `app/lib/__tests__/theme.test.ts`, `app/routes/__tests__/api.command.test.ts`, `app/lib/__tests__/format.test.ts`

**Interfaces:**
- Produces (`theme.ts`): `export type ThemePref = "light" | "dark" | "system"`; `export function resolveTheme(pref: ThemePref, prefersDark: boolean): "light" | "dark"`; `export const THEME_INIT_SCRIPT: string` (reads `localStorage.theme`, falls back to `system`, sets `document.documentElement.dataset.theme`); `export function useTheme(): { pref: ThemePref; resolved: "light" | "dark"; setPref(p: ThemePref): void }`.
- Produces (`format.ts`): `export function fmtDate(iso: ISODate): string` → `"Oct 20"`; `export function fmtDateLong(iso): string` → `"Mon, Oct 20 2026"`; `export function fmtScheduleSummary(s: Schedule, semester: Semester): string` → `"One-time · Oct 20"`, `"Weekly · Oct 1 → Dec 31"`, `"Weekly · Oct 1 → end of semester"`, `"Custom · 4 dates"`, `"Per semester · Dec 20"`, `"Daily …"`, `"Monthly …"`.
- Produces (`use-workspace.ts`): `export function useWorkspace(): { workspace: Workspace; version: number; today: ISODate; capacities: Record<string, number>; taById: Map<string, TA> }` from `useRouteLoaderData("root")`.
- Produces (`use-command.ts`): `export function useCommand(): { submit(cmd: Command, opts?: { toast?: string }): void; pending: boolean }` — POSTs `{ command }` JSON to `/api/command` via `useFetcher`; on `{ ok: true, snapshotId, label }` shows toast `label` with **Undo** (POST `/api/history` `{ intent: "rollback", snapshotId }`); on `{ ok: false, message }` shows error toast.
- Produces (`api.command.tsx` action): request JSON `{ command: Command }` → `applyCommand(getStore(), command)` → `200 { ok: true, version, snapshotId, label: describe(cmd, old) }`; `EngineError` → `400 { ok: false, message, code }`.
- Produces (`api.preview.tsx` action): `{ command }` → `200 { ok: true, workspace }` or `400`.
- Produces (`api.history.tsx` action): `{ intent: "rollback", snapshotId }` | `{ intent: "snapshot", name }` | `{ intent: "deleteHistory", password }` → `{ ok, ... }`; wrong password → `403 { ok: false, message: "Wrong password." }`.
- Root loader returns `{ workspace, version, today }` (today = server `format(new Date(), "yyyy-MM-dd")`). Root `<Layout>` injects `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />` first in `<head>`, fonts Sora + Inter, `<AppShell>` with `Header` (brand, desktop nav, `ThemeToggle`, settings button placeholder), `NavBar` bottom tabs on `< md`, `Background` (drifting mesh gradient, 3 blurred blobs animated by CSS keyframes, paused under reduced motion), `AnimatePresence` + `motion.div` keyed by `useLocation().pathname` around `<Outlet/>`, `<ToastProvider/>`.
- `app.css`: `@import "tailwindcss"; @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` tokens on `:root` (`--bg: #f6f3ee; --surface: rgba(255,255,255,.65); --ink: #16141a; --muted: #6b6672; --line: rgba(22,20,26,.1); --accent: #6d5dfc; --accent-2: #ff6b5c; --mint: #2fd3a6`) and `[data-theme=dark]` (`--bg:#0e0f14; --surface: rgba(22,24,32,.6); --ink:#eceae4; --muted:#9a97a6; --line: rgba(236,234,228,.1)`), exposed with `@theme inline { --color-bg: var(--bg); --color-surface: var(--surface); --color-ink: var(--ink); --color-muted: var(--muted); --color-line: var(--line); --color-accent: var(--accent); --color-accent-2: var(--accent-2); --color-mint: var(--mint); --font-display: "Sora", ui-sans-serif, sans-serif; --font-sans: "Inter", ui-sans-serif, sans-serif; }`; `body { background: var(--bg); color: var(--ink); }`; `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } }`.
- `routes.ts`: `index("routes/home.tsx")`, `route("team","routes/team.tsx")`, `route("tasks","routes/tasks.tsx")`, `route("tasks/:taskId","routes/task-detail.tsx")`, `route("calendar","routes/calendar.tsx")`, `route("history","routes/history.tsx")`, `route("api/command","routes/api.command.tsx")`, `route("api/preview","routes/api.preview.tsx")`, `route("api/history","routes/api.history.tsx")`.

- [ ] **Step 1: Write failing tests**

```ts
// app/lib/__tests__/theme.test.ts
import { resolveTheme, THEME_INIT_SCRIPT } from "~/lib/theme";
test("system follows the OS preference, explicit prefs win", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
});
test("init script sets data-theme from localStorage", () => {
  expect(THEME_INIT_SCRIPT).toContain("localStorage");
  expect(THEME_INIT_SCRIPT).toContain("data-theme");
});
```
```ts
// app/lib/__tests__/format.test.ts
import { fmtScheduleSummary, fmtDate } from "~/lib/format";
const sem = { name: "F26", start: "2026-09-01", end: "2026-12-31" };
test("fmtDate", () => { expect(fmtDate("2026-10-20")).toBe("Oct 20"); });
test("schedule summaries", () => {
  expect(fmtScheduleSummary({ type: "one-time", date: "2026-10-20" }, sem)).toBe("One-time · Oct 20");
  expect(fmtScheduleSummary({ type: "weekly", start: "2026-10-01", end: null }, sem)).toBe("Weekly · Oct 1 → end of semester");
  expect(fmtScheduleSummary({ type: "custom", start: "2026-10-01", count: 4, gapDays: 3, dates: ["a","b","c","d"] }, sem)).toBe("Custom · 4 dates");
});
```
```ts
// app/routes/__tests__/api.command.test.ts
import { action } from "~/routes/api.command";
const post = (body: unknown) => action({ request: new Request("http://x/api/command", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params: {}, context: {} } as any);
test("applies a command and returns the snapshot id and label", async () => {
  const res = await post({ command: { type: "addTA", name: "Ahmed" } });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, label: 'Added TA "Ahmed"', snapshotId: expect.any(Number) });
});
test("api.command returns 400 with the error message", async () => {
  const res = await post({ command: { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } } });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false, message: "Assign sections to at least one TA first." });
});
```
(Set `process.env.DATA_STORE = "memory"` in `app/test-setup.ts`.)

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/lib app/routes` — Expected: FAIL, modules not found.
- [ ] **Step 3: Implement theme, format, resource routes, hooks, shell components, route stubs, css, routes.ts**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 56 tests.
- [ ] **Step 5: Manual check** — Run: `DATA_STORE=memory npm run dev` → open http://localhost:5173 — Expected: themed shell renders, nav switches pages with a fade/slide, theme toggle flips `data-theme` and persists across reload without a flash, bottom tab bar appears below 768px.
- [ ] **Step 6: Typecheck & commit** — Run: `npm run typecheck` → exit 0. `git add -A app && git commit -m "feat(app): shell, theme, resource routes, command hook"`.

---

### Task 8: UI primitives

**Files:**
- Create: `app/components/ui/{Card,Gauge,Sheet,ConfirmDialog,Field,Select,EmptyState}.tsx`
- Test: `app/components/ui/__tests__/Gauge.test.tsx`, `app/components/ui/__tests__/Sheet.test.tsx` (both with `// @vitest-environment jsdom`)

**Interfaces:**
- `Button({ variant?: "primary"|"ghost"|"danger"; size?: "sm"|"md"; loading?: boolean; ...buttonProps })` — `motion.button`, `whileHover={{ y: -1 }}`, `whileTap={{ scale: 0.96 }}`, min height 44px.
- `Card({ children; className?; interactive?: boolean })` — glass surface, `interactive` adds tilt on hover (`useMotionValue` for rotateX/rotateY).
- `Gauge({ value: number /*0..1*/; color: string; label: string; size?: number })` — circular liquid fill: SVG circle clipPath, wave path translated by spring-animated `value`; renders `aria-label="{label}: {Math.round(value*100)}% used"` and the percent as text.
- `Sheet({ open; onClose; title; children })` — bottom sheet on `< md` (drag down to dismiss via `drag="y"`), centered modal on desktop; closes on Escape and backdrop click; focus trapped; `role="dialog"`.
- `ConfirmDialog({ open; title; body; confirmLabel; danger?; onConfirm; onClose })` built on Sheet.
- `Field({ label; hint?; error?; children })`, `Select` (styled native `<select>`), `EmptyState({ icon; title; body; action? })`.

- [ ] **Step 1: Write failing tests**

```tsx
// Gauge.test.tsx
import { render, screen } from "@testing-library/react";
import { Gauge } from "~/components/ui/Gauge";
test("renders the used percentage", () => {
  render(<Gauge value={2 / 3} color="#f00" label="Dina" />);
  expect(screen.getByLabelText("Dina: 67% used")).toBeInTheDocument();
  expect(screen.getByText("67%")).toBeInTheDocument();
});
// Sheet.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "~/components/ui/Sheet";
test("closes on Escape", () => {
  const onClose = vi.fn();
  render(<Sheet open onClose={onClose} title="Hi"><p>body</p></Sheet>);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/components` — Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the primitives**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 58 tests.
- [ ] **Step 5: Commit** — `git add app/components && git commit -m "feat(ui): primitives — card, gauge, sheet, dialog, fields"`.

---

### Task 9: Team page

**Files:**
- Modify: `app/routes/team.tsx`
- Create: `app/components/team/{TAList,TAChip,SectionsBoard,SectionCard,SlotPicker}.tsx`
- Test: `app/components/team/__tests__/SectionsBoard.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `useWorkspace`, `useCommand`, `Card`, `Sheet`, `Button`, `Field`, `ConfirmDialog`, dnd-kit.
- `TAList({ tas; capacities; occurrenceCounts: Record<string, number>; onAdd(name); onRename(id,name); onRemove(id) })` — inline add form, tap name to rename, remove opens `ConfirmDialog` with body `"<name> has <n> task occurrences; they will be re-distributed to the other TAs."`.
- `TAChip({ ta; capacity; draggable? })` — `useDraggable({ id: ta.id })`.
- `SectionsBoard({ sections; tas; onAddSection(name); onRename(id,name); onSetSlot(sectionId, slot, taId|null); onRemove(id) })` — `DndContext` with `PointerSensor` + `TouchSensor({ activationConstraint: { delay: 150, tolerance: 5 } })`; each `SectionCard` has two `useDroppable` slots with ids `${sectionId}:${slot}`; `onDragEnd` → `onSetSlot`. Tapping an empty slot opens `SlotPicker` (Sheet listing TAs); tapping a filled slot shows "Clear" + picker. `layout` animations on add/remove.
- Route `team.tsx`: two-column grid (`md:grid-cols-[320px_1fr]`), header with TA count and `turnSize`; empty states.

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionsBoard } from "~/components/team/SectionsBoard";
const tas = [{ id: "A", name: "Ahmed", color: "#f00" }];
test("tapping an empty slot and choosing a TA calls onSetSlot", () => {
  const onSetSlot = vi.fn();
  render(<SectionsBoard sections={[{ id: "s1", name: "S1", taIds: [null, null] }]} tas={tas}
    onAddSection={() => {}} onRename={() => {}} onSetSlot={onSetSlot} onRemove={() => {}} />);
  fireEvent.click(screen.getAllByRole("button", { name: /empty slot/i })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Ahmed" }));
  expect(onSetSlot).toHaveBeenCalledWith("s1", 0, "A");
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/components/team` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement components and route**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 59 tests.
- [ ] **Step 5: Manual check** — `DATA_STORE=memory npm run dev`: add 4 TAs, 4 sections, drag chips into slots (mouse) and tap-to-pick (Chrome device emulation, touch) → capacity badges read 1/2/2/3; remove a TA → confirm dialog appears.
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(team): TA list and drag-and-drop section board"`.

---

### Task 10: Tasks page, New-task sheet with preview, task detail

**Files:**
- Modify: `app/routes/tasks.tsx`, `app/routes/task-detail.tsx`
- Create: `app/components/tasks/{TaskCard,NewTaskSheet,StepName,StepSchedule,StepPreview,CustomDatesEditor,SplitBar}.tsx`
- Test: `app/components/tasks/__tests__/CustomDatesEditor.test.tsx`, `app/components/tasks/__tests__/StepPreview.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `useCommand`, `customDates`, `generateDates`, `fmtScheduleSummary`, `Sheet`, `Gauge`, `/api/preview`.
- `NewTaskSheet({ open; onClose })` — local state `{ step: 0|1|2; title; notes; schedule: Schedule }`; `AnimatePresence mode="wait"` slides steps horizontally; step 2 fetches `/api/preview` with `{ command: { type: "createTask", ... } }` and renders `StepPreview`; Confirm → `submit(createTask)` → close. Open via `/tasks?new=1` (the "New task" button sets the param so a refresh keeps the sheet).
- `StepSchedule({ schedule; semester; onChange })` — segmented control of the six types (animated indicator); fields per type; for custom shows `CustomDatesEditor`.
- `CustomDatesEditor({ start; count; gapDays; dates; onChange(next: { start; count; gapDays; dates }) })` — Generate button fills `dates = customDates(start, count, gapDays)`; each date chip has a `<input type="date">` to edit; remove chip; add chip.
- `StepPreview({ preview: Workspace | null; taskTitle; loading; error })` — list of `{date, TA chip}` rows with staggered entrance; right column: gauges for every TA as they'd look after; shows `"N occurrences"`.
- `TaskCard({ task; onRedistribute; onDelete })` — title, `fmtScheduleSummary`, count, `SplitBar` (per-TA segments proportional to occurrence counts), menu with Redistribute / Delete (ConfirmDialog).
- `task-detail.tsx` — occurrences table: date, TA `<Select>` (change → `reassignOccurrence`), back link.

- [ ] **Step 1: Write failing tests**

```tsx
// CustomDatesEditor.test.tsx
test("Generate fills count dates spaced by gap", () => {
  const onChange = vi.fn();
  render(<CustomDatesEditor start="2026-10-01" count={3} gapDays={10} dates={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /generate/i }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dates: ["2026-10-01", "2026-10-11", "2026-10-21"] }));
});
// StepPreview.test.tsx
test("preview lists every occurrence with its TA", () => {
  const ws = { ...emptyWorkspace(), tas: [{ id: "A", name: "Ahmed", color: "#f00" }],
    tasks: [{ id: "t", title: "Quiz", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [{ id: "o", date: "2026-10-20", taId: "A", turn: 1 }] }] };
  render(<StepPreview preview={ws} taskTitle="Quiz" loading={false} error={null} />);
  expect(screen.getByText("1 occurrence")).toBeInTheDocument();
  expect(screen.getByText("Oct 20")).toBeInTheDocument();
  expect(screen.getByText("Ahmed")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/components/tasks` — Expected: FAIL, modules not found.
- [ ] **Step 3: Implement components and routes**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 61 tests.
- [ ] **Step 5: Manual check** — with the Task 9 team: New task → weekly, 10 dates → preview shows 10 rows and gauges A 100%, B 50%, C 0%, D 0% → Confirm → card appears with split bar; open detail, reassign one occurrence; Redistribute; Delete.
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(tasks): task list, 3-step creation sheet with live preview, task detail"`.

---

### Task 11: Dashboard

**Files:**
- Modify: `app/routes/home.tsx`
- Create: `app/components/dashboard/{TACard,TurnHeader,Timeline,SwapSheet}.tsx`, `app/components/ui/CountUp.tsx`
- Test: `app/components/dashboard/__tests__/TurnHeader.test.tsx`, `app/components/dashboard/__tests__/Timeline.test.tsx` (jsdom)

**Interfaces:**
- `TurnHeader({ turn; usedUnits; turnSize })` → text `Turn {turn} · {usedUnits}/{turnSize} units used` (when `turnSize === 0`: `No sections yet`).
- `TACard({ ta; capacity; used; totalOccurrences; nextDates: ISODate[]; onSwap() })` — `Card interactive`, `Gauge value={capacity ? Math.min(used, capacity) / capacity : 0}`, `CountUp` numbers, "Swap…" button opens `SwapSheet`.
- `SwapSheet({ open; onClose; ta })` — step 1: list this TA's occurrences (task title + date); step 2: list all other occurrences grouped by task; choose → `submit(swapOccurrences)`.
- `Timeline({ tasks; taById; today; days = 14 })` — occurrences with `today ≤ date < today + days`, grouped by date, vertical line with staggered entrance; empty → "Nothing in the next 14 days".
- `home.tsx` — `TurnHeader`, responsive grid of `TACard`s (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`), `Timeline`; `EmptyState` → link to Team when `tas.length === 0`.

- [ ] **Step 1: Write failing tests**

```tsx
test("TurnHeader shows turn and units", () => {
  render(<TurnHeader turn={2} usedUnits={5} turnSize={8} />);
  expect(screen.getByText("Turn 2 · 5/8 units used")).toBeInTheDocument();
});
test("Timeline shows only the next 14 days", () => {
  const tasks = [{ id: "t", title: "Quiz", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [
    { id: "1", date: "2026-10-17", taId: "A", turn: 1 }, { id: "2", date: "2026-11-30", taId: "A", turn: 1 }] }];
  render(<Timeline tasks={tasks as any} taById={new Map([["A", { id: "A", name: "Ahmed", color: "#f00" }]])} today="2026-10-16" />);
  expect(screen.getByText("Oct 17")).toBeInTheDocument();
  expect(screen.queryByText("Nov 30")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/components/dashboard` — Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 63 tests.
- [ ] **Step 5: Manual check** — gauges animate on load and on change; cards tilt on hover; Swap flow trades two occurrences and gauges stay unchanged.
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(dashboard): gauges, turn header, timeline, swap sheet"`.

---

### Task 12: Calendar

**Files:**
- Modify: `app/routes/calendar.tsx`
- Create: `app/components/calendar/{MonthGrid,DayCell,OccurrencePill,OccurrencePopover}.tsx`, `app/lib/calendar.ts`
- Test: `app/lib/__tests__/calendar.test.ts`, `app/components/calendar/__tests__/MonthGrid.test.tsx` (jsdom)

**Interfaces:**
- `app/lib/calendar.ts`: `export function monthCells(yearMonth: string /*"2026-10"*/): { date: ISODate; inMonth: boolean }[]` — 6×7 grid starting Monday; `export function occurrencesByDate(tasks: Task[]): Map<ISODate, { task: Task; occ: Occurrence }[]>`.
- `MonthGrid({ yearMonth; tasks; taById; selected: OccurrenceRef | null; swapSource: OccurrenceRef | null; onSelect(ref) })` — `AnimatePresence` slides month on prev/next (direction-aware); pills `OccurrencePill` colored by TA; when `swapSource` set, other pills pulse and clicking one completes the swap.
- `OccurrencePopover({ ref; task; occ; tas; onReassign(taId); onStartSwap(); onClose })`.
- Route: `?m=2026-10` search param for month (default = `today`'s month); legend of TAs.

- [ ] **Step 1: Write failing tests**

```ts
test("monthCells starts on Monday and covers 42 days", () => {
  const cells = monthCells("2026-10");
  expect(cells).toHaveLength(42);
  expect(cells[0].date).toBe("2026-09-28");
  expect(cells.filter(c => c.inMonth)).toHaveLength(31);
});
```
```tsx
test("clicking a pill while in swap mode selects the target", () => {
  const onSelect = vi.fn();
  const tasks = [{ id: "t", title: "Quiz", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [
    { id: "1", date: "2026-10-05", taId: "A", turn: 1 }, { id: "2", date: "2026-10-06", taId: "A", turn: 1 }] }];
  render(<MonthGrid yearMonth="2026-10" tasks={tasks as any} taById={new Map([["A", { id: "A", name: "Ahmed", color: "#f00" }]])}
    selected={null} swapSource={{ taskId: "t", occurrenceId: "1" }} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: /Quiz.*Oct 6/i }));
  expect(onSelect).toHaveBeenCalledWith({ taskId: "t", occurrenceId: "2" });
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/lib/__tests__/calendar.test.ts app/components/calendar` — Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 65 tests.
- [ ] **Step 5: Manual check** — month navigation slides; tap pill → popover → reassign updates colour; swap mode highlights and completes.
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(calendar): month grid with reassign and swap"`.

---

### Task 13: History page, Settings panel, Undo toasts, Reset

**Files:**
- Modify: `app/routes/history.tsx`, `app/components/layout/Header.tsx`, `app/root.tsx`
- Create: `app/components/history/{SnapshotList,SnapshotRow,PasswordDialog}.tsx`, `app/components/layout/SettingsPanel.tsx`, `app/lib/use-history.ts`
- Test: `app/routes/__tests__/api.history.test.ts`, `app/components/history/__tests__/SnapshotList.test.tsx` (jsdom)

**Interfaces:**
- `history.tsx` loader → `{ snapshots: SnapshotMeta[], version }`; page renders `SnapshotList` + "Save snapshot" form + "Delete history" (opens `PasswordDialog`).
- `use-history.ts`: `useHistory(): { rollback(id); saveSnapshot(name); deleteHistory(password): Promise<boolean>; pending }` posting to `/api/history`.
- `SnapshotList({ snapshots; currentVersion; onRollback(id) })` — rows show label, name badge for manual, relative time (`date-fns formatDistanceToNow`), the newest row carries a "Latest change" marker (its `data` is the state before the current version). Rollback → ConfirmDialog.
- `SettingsPanel({ open; onClose })` — semester form (`setSemester`), theme segmented control (`useTheme`), "Redistribute everything" (ConfirmDialog, danger), "Reset everything" (ConfirmDialog, danger, body: "A snapshot is saved first, so you can roll back from History.").
- Header settings button opens the panel (slide-over from right, `Sheet`-like).

- [ ] **Step 1: Write failing tests**

```ts
// api.history.test.ts
import { action } from "~/routes/api.history";
const post = (body) => action({ request: new Request("http://x/api/history", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params: {}, context: {} } as any);
test("deleteHistory with wrong password is 403", async () => {
  process.env.HISTORY_DELETE_PASSWORD = "secret";
  const res = await post({ intent: "deleteHistory", password: "nope" });
  expect(res.status).toBe(403);
});
test("snapshot then rollback", async () => {
  const s = await (await post({ intent: "snapshot", name: "Before exam" })).json();
  const r = await (await post({ intent: "rollback", snapshotId: s.snapshotId })).json();
  expect(r.ok).toBe(true);
});
```
```tsx
// SnapshotList.test.tsx
test("renders labels and marks manual snapshots", () => {
  render(<SnapshotList currentVersion={3} onRollback={() => {}} snapshots={[
    { id: 2, name: "Before exam", label: 'Snapshot "Before exam"', kind: "manual", version: 2, createdAt: new Date().toISOString() },
    { id: 1, name: null, label: 'Added TA "A"', kind: "auto", version: 1, createdAt: new Date().toISOString() }]} />);
  expect(screen.getByText('Added TA "A"')).toBeInTheDocument();
  expect(screen.getByText("Before exam")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify fail** — Run: `npx vitest run app/routes app/components/history` — Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run to verify pass** — Run: `npx vitest run` — Expected: PASS 68 tests.
- [ ] **Step 5: Manual check** — every action shows a toast with Undo; Undo restores; History lists snapshots; rollback works; Reset creates "Reset everything" snapshot; Delete history with wrong password shows "Wrong password.", with correct password empties the list.
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(history): snapshots, rollback, settings panel, undo toasts, reset"`.

---

### Task 14: Polish, Supabase provisioning, Vercel deploy

**Files:**
- Modify: `README.md`, `app/components/**` as needed, `.gitignore` (add `.vercel`)
- Create: `vercel.json` only if the preset needs it (it should not)

- [ ] **Step 1: Reduced-motion + mobile audit** — Chrome DevTools: emulate `prefers-reduced-motion: reduce` → no gauge waves, no page slides, no background drift; 375px width → no horizontal scroll on any page, bottom tabs reachable, sheets draggable. Fix findings (each fix with a test where it is logic).
- [ ] **Step 2: Lighthouse** — Run Lighthouse (a11y) on `/` and `/tasks` — Expected: Accessibility ≥ 95. Fix contrast/label issues.
- [ ] **Step 3: Supabase** — Load `supabase:supabase` and `supabase:supabase-postgres-best-practices` first. Connect the Supabase MCP (or obtain URL + service key from the user); create project; apply `supabase/migrations/0001_init.sql` via `apply_migration`; fill local `.env`; `npm run dev` (without `DATA_STORE=memory`) → add a TA → `select version from workspace` returns 2 and `snapshots` has 1 row.
- [ ] **Step 4: Build** — Run: `npm run typecheck && npm run build` — Expected: exit 0, `build/` contains Vercel output.
- [ ] **Step 5: Deploy** — Vercel project linked to the repo; env vars set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HISTORY_DELETE_PASSWORD`); deploy; run the spec's end-to-end walkthrough (A/B/C/D scenario, swap, rollback, reset, delete-history) on the deployed URL from a laptop and a phone.
- [ ] **Step 6: README** — replace the template README: what it is, local dev (`DATA_STORE=memory npm run dev`), env vars, Supabase migration, deploy.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "chore: polish, README, deployment"`.

---

## Self-review notes

- Spec coverage: A1 → T1; A2 → T2–T5; A3 → T6 (+T14 live); A4 → T7–T13; A5 → T7/T8/T14; A6 → Task 0 scaffold (already applied in the working tree: RR 7.18.4 pinned, deps installed, vitest config, Vercel preset, `.env.example`) — commit it as the first commit of the branch before Task 1.
- Review Focus items 1–5 each have a named test in T4, T4/T7, T2, T6, T6.
- Names used consistently: `assignOccurrences`, `refund`, `reduce`, `describe`, `testContext`, `applyCommand`, `previewCommand`, `rollback`, `saveSnapshot`, `deleteHistory`, `useCommand`, `useWorkspace`, `OccurrenceRef`.
