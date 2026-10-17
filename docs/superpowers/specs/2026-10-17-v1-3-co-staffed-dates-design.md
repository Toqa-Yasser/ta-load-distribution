# TA Load Distribution v1.3 — Co-staffed dates (1, 2 or more TAs per task)

## Context

v1.2 shipped. Every occurrence is held by exactly one TA. The coordinator wants tasks that need two
or more TAs on the same date (a lab that needs two people in the room). Each TA on the date burns
one unit of their load, so a 2-TA task costs twice a 1-TA task.

User decisions (do not re-ask):
- **Co-staffed dates**, not shared load and not a restricted pool: every date of the task is covered
  by `taCount` distinct TAs, each charged one unit.
- **Reject, never half-fill**: a deal that cannot seat `taCount` distinct TAs fails with a clear
  error. Removing a TA is rejected when a seat they held cannot be refilled.
- **`taCount` is locked at creation**, like the kind. Changing it means delete and recreate.
- **Data model A**: one occurrence per date holding a list of seats (not N occurrences per date).
- **Calendar pill B2**: multi-TA pills get a soft left-to-right gradient of the seated TAs' tints
  plus a stripe split into one band per TA. Single-TA pills are unchanged.

## 1. Model

```ts
export interface Seat { taId: string; turn: number }
export interface Occurrence { id: string; date: ISODate; seats: Seat[] }
export interface Task { …; taCount: number }                 // integer ≥ 1, immutable
export type SeatRef = OccurrenceRef & { taId: string };
```

Invariants (maintained by the reducer, not asserted by the validator): `seats.length === task.taCount`
and the `taId`s within one occurrence are distinct.

The turn lives on the seat because seats move independently: a swap trades one seat, and a removed
TA's seat is refilled in the current turn while the other seats keep theirs. A seat is exactly what
an occurrence is today, so every ledger invariant carries over: `ledger.used[ta]` is the number of
current-turn seats `ta` holds.

`emptyWorkspace()` is unchanged apart from the types.

## 2. Engine

### 2.1 Dealing (`assignOccurrences`)

```ts
interface PendingOccurrence { id: string; date: ISODate; seats?: Seat[] }   // seats already held (refill)
assignOccurrences({ capacities, ledger, occurrences, taCount, rng })
```

For each pending occurrence in date order:
1. `eligible` = TAs with capacity > 0. If `eligible.length === 0` → `NoCapacityError` (unchanged
   message). If `eligible.length < taCount` → `NotEnoughTAsError(taCount, eligible.length)`:
   `"This task needs 3 TAs but only 2 have sections."` (`"… but only 1 has sections."` for one), code
   `NOT_ENOUGH_TAS`. Paths that deal several tasks or act from outside the wizard (`removeTA`,
   `redistributeTask`, `redistributeAll`, `setSemester`) name the task instead:
   `"Lab" needs 2 TAs on each date but only 1 has sections.` Both checks run once,
   before any occurrence is dealt, so a failed deal changes nothing.
2. If every eligible TA has `used ≥ capacity` → `turn++`, `used[ta] = max(0, used[ta] − capacity[ta])`
   for every TA (overshoot carries forward). For 1-TA tasks overshoot never happens, so this equals
   today's reset, with one exception: a TA whose current-turn usage already exceeds a capacity that
   shrank mid-turn now carries the excess instead of having it forgotten ("Redistribute everything"
   resets the ledgers if that is unwanted). Carried units are not tied to a seat, so deleting or
   redistributing the task that caused the overshoot does not release them; they clear at the next
   rollover or on "Redistribute everything". The check runs once per occurrence, before its first pick.
3. Pick `taCount − seats.length` TAs one at a time: among eligible TAs not already seated on this
   occurrence, take the highest `remainingFraction`; ties → `pick(tied, rng)`. Each pick does
   `used[ta]++` and appends `{ taId, turn }`. A pick may take a TA whose `used ≥ capacity` when every
   other TA is seated or full (overshoot).
4. Output occurrence = `{ id, date, seats: [...kept, ...picked] }`.

With `taCount === 1` and no kept seats, steps 1–4 reproduce today's algorithm exactly. The existing
distribution tests pass with only fixture-shape changes.

### 2.2 Refund

`refund(ledger, occurrences)`: for every seat with `seat.turn === ledger.turn`, `used[seat.taId]−−`
(min 0). `refundSeats(ledger, seats)` is the same for an explicit seat list (used by `removeTA`).

### 2.3 Commands

| command | change |
|---|---|
| `createTask` | gains `taCount?: number` (default 1). `ValidationError("TAs per date must be a whole number of at least 1.")` for non-integers or < 1. Deals with `taCount`; may throw `NotEnoughTAsError`. |
| `updateTask` | schedule edits re-deal with `task.taCount`. `taCount` cannot be changed (not in the command). |
| `deleteTask` | `refund` over all seats. |
| `redistributeTask`, `redistributeAll`, `setSemester` (extend) | re-deal / deal with each task's own `taCount`; may throw `NotEnoughTAsError`. `redistributeAll` fails atomically (workspace unchanged) if any task cannot be dealt. |
| `setSemester` (truncate) | refund over dropped occurrences' seats. |
| `removeTA` | For each kind: orphan seats = seats held by the TA. `refundSeats`, delete `used[taId]`, then refill the orphaned occurrences one at a time in date order across tasks (each with its own `task.taCount`, `assignOccurrences({ …, occurrences: [{ id, date, seats: remainingSeats }], taCount })`), threading the kind's ledger — the same order today's single re-deal uses, so 1-TA tasks are refilled exactly as before. If any refill throws, the command throws and nothing changes. Section slots are cleared as today. |
| `setSectionSlot`, `removeSection` | unchanged: existing assignments are never blocked by capacity changes; later deals may throw. |
| `swapOccurrences` | `{ a: SeatRef; b: SeatRef }`. Rejected when: same occurrence (`"Pick two different occurrences to swap."`); different kinds (`"Only tasks of the same kind can be swapped."`); seat not found (`"Unknown occurrence."` / `"Unknown TA."`); `a.taId === b.taId` (no-op: returns `ws`); `b.taId` already seated on `a`'s occurrence or `a.taId` on `b`'s (`"A TA can't hold the same date twice."`). Effect: the two seats trade `taId` and `turn`; ledger untouched. |
| `reassignOccurrence` | `{ ref: OccurrenceRef; from: string; taId: string }` — engine only, no UI sends it. Moves the seat held by `from` to `taId`; rejected if `taId` is already seated on the occurrence. Ledger rule unchanged (current-turn seat moves its unit). |

`describe()`: `createTask` → `Added heavy task "X" for 2 TAs` when `taCount > 1`, otherwise as today.
`swapOccurrences` → `Swapped Sara ↔ Omar` (seat TAs). Others unchanged.

### 2.4 Capacity

`capacities`, `turnSize`, `remainingFraction` unchanged. `eligibleCount(ws) = number of TAs with
capacity > 0` is exported for the wizard's stepper cap and the error path.

## 3. Stored data and migration

`upgradeWorkspace(doc)` becomes a chain:
1. v1.0 (`ledger`, tasks without `kind`) → v1.1: as today.
2. v1.1 (`ledgers`, occurrences with `taId` + `turn`, tasks without `taCount`) → v1.3: each
   occurrence `{ id, date, taId, turn }` → `{ id, date, seats: [{ taId, turn }] }`; each task gains
   `taCount: 1`. Mixed documents (some tasks already in the new shape) are accepted.
3. Current documents return the same reference.

`isCurrentWorkspace` requires every task to have an integer `taCount ≥ 1` and every occurrence a
non-empty `seats` array of `{ taId: string, turn: number }`. It does not check `seats.length ===
taCount` or distinctness (a validator that throws on a slightly off document would lock the user
out). `loadWorkspace`'s write-back and the rollback upgrade path are unchanged; the auto snapshot is
labelled `Upgraded to co-staffed dates`. The Supabase store holds the document as JSON: no schema
change. `readCommand` shape checks gain `taCount` and `SeatRef`.

## 4. UI

### 4.1 New task wizard
- **Step 1** gains a "TAs per date" stepper (−, number, +) with a visible "TAs per date" label, under the kind control. Range 1 …
  `max(1, eligibleCount(ws))`, default 1. Hint: "Each date is covered by this many TAs together.
  Every one of them counts it toward their load." When the cap is 1 the + is disabled and the hint
  reads "Give more TAs sections to co-staff dates." Component: `components/ui/Stepper.tsx`
  (accessible `role="spinbutton"` with `aria-valuemin/max/now`, 44px targets).
- **Step 3 (preview)**: each date row shows one chip per seat. The gauges already include the extra
  units. The engine's `NotEnoughTAsError` renders in the existing error block.

### 4.2 Tasks page and task detail
- `fmtScheduleSummary` output gets ` · 2 TAs per date` appended when `taCount > 1` (card subtitle and
  detail header).
- Occurrence counts stay dates ("12 occurrences"). `SplitBar` counts seats (a 2-TA task with 12 dates
  shows 24 units); its `aria-label` and legend count seats.
- Task detail's TA column lists every seat as a chip.

### 4.3 Calendar
- **Pill**: `taCount === 1` renders exactly as today (22% tint, 4px solid stripe). For more seats:
  background `linear-gradient(to right, tint(ta1), tint(ta2), …)` at 28% mix; the stripe is a
  `linear-gradient(to bottom, …)` with equal hard bands, one per seat, in seat order. Accessible
  name lists every TA: `Lab · Oct 21 · Sara, Omar · Heavy`.
- **Popover**: "Assigned TA" → "Assigned TAs"; one row per seat, each with its own `Swap…` button
  (accessible name `Swap <name>`). With one seat the layout is as today (owner line, then `Open task`
  and `Swap with…`). In pick mode the lead text names the moving seat: `Swap Omar's seat with`.
- **Swap mode**: `swapSource: SeatRef`. A pill is a valid target when it is a different occurrence of
  the same kind and has at least one seat whose TA ≠ source TA and is not already seated on the
  source occurrence, and the source TA is not already seated on it. Pills with no valid seat are
  dimmed (`ineligible`). Tapping a pill with exactly one valid seat swaps immediately (whether the
  pill has one seat or several); a pill with two or more valid seats opens the popover in "pick a
  seat" mode listing only those seats, and picking one submits the swap. When the source occurrence
  has several seats the status bar names the moving seat: `Swapping Omar's seat — pick another heavy
  occurrence`; for a single-seat source it is unchanged. A pick-mode popover closes when swap mode
  ends underneath it.

### 4.4 Dashboard
- **SwapSheet** step 1 lists the TA's seats (every date they sit on). Step 2 lists one row per valid
  seat on other same-kind occurrences with that seat's owner, using the same exclusions as the calendar.
  `onSwap(a: SeatRef, b: SeatRef)`.
- **stats**: `totalOccurrences`, `counts` and `nextDates` iterate seats. Timeline rows list every TA on
  the date as chips. The team page's per-TA counts iterate seats.

### 4.5 Copy
README gains a "TAs per date" paragraph under the fairness explanation: what co-staffing is, that
each TA is charged a unit, and that the count is fixed at creation.

## 5. Tests

**Engine** (`app/engine/__tests__`): a 2-TA deal seats distinct TAs with the highest remaining
fractions; overshoot carries across a rollover; `eligible < taCount` throws `NotEnoughTAsError` with
the exact message and `eligible === 0` still throws `NoCapacityError`; a failed deal leaves the
workspace unchanged; `refund` releases every current-turn seat; `removeTA` refills only the removed
TA's seats with a distinct TA and is rejected when a seat cannot be refilled; `swapOccurrences`
enforces the no-duplicate rule, is a no-op for the same TA and leaves the ledger unchanged;
`reassignOccurrence` rejects a duplicate; `describe` labels; the migration chain from v1.0 and v1.1
fixtures and the same-reference pass-through; `isCurrentWorkspace` rejects a task without `taCount`
and an occurrence without seats. All existing engine tests pass with fixture-shape changes only.

**UI**: the stepper's cap follows `eligibleCount` and `taCount` is sent in the create command; the
preview row shows all seats; the pill's accessible name lists all TAs and its stripe has one band
per seat; the popover lists seats with a swap button each; calendar swap mode dims pills with no valid
seat and opens the seat chooser on a multi-seat pill; the swap sheet lists seats with owners and
excludes duplicates; stats and `SplitBar` count seats; `fmtScheduleSummary` appends the TA count.

## 6. Out of scope
Changing `taCount` after creation; partially filled dates; per-task TA pools; weighting a co-staffed
date as less than one unit per TA.
