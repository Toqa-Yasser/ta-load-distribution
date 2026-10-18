# TA Load Distribution v1.4 — Equal tasks (round-robin, not by load)

## Context

v1.3 shipped. Every task is light or heavy, and both kinds deal dates by load: each date goes to the
TA with the most section capacity left, ties at random, until the turn is full. The coordinator also
has tasks that should simply go round the TAs one date each, regardless of how many sections anyone
covers (a weekly duty shared A, B, D, A, B, D).

User decisions (do not re-ask):
- **A third kind, "Equal"**, chosen in the new-task wizard beside Light and Heavy. Same schedules as
  the other kinds (one-time, daily, weekly, monthly, custom), same "TAs per date".
- **Equal ignores load.** Every TA on the Team page takes part, including TAs with no sections.
- **The coordinator sets the TA order** when creating the task. A **"Team list order"** button fills
  the order from the Team page.
- **Pure rotation**: with order A, B, D and six dates the result is A, B, D, A, B, D. No randomness.
- **The order belongs to the task** and is fixed at creation. Every Equal task starts from its own
  first TA; a second Equal task does not continue where the first stopped. A TA added later does not
  join existing Equal tasks.

## 1. Model

```ts
export type TaskKind = "light" | "heavy" | "equal";
/** Kinds dealt by load from a turn ledger. */
export type LoadKind = "light" | "heavy";
export const TASK_KINDS = ["light", "heavy", "equal"] as const;
export const LOAD_KINDS = ["light", "heavy"] as const;
export const KIND_LABEL: Record<TaskKind, string> = { light: "Light", heavy: "Heavy", equal: "Equal" };
export function isLoadKind(kind: TaskKind): kind is LoadKind;

export interface Task { …; kind: TaskKind; taOrder?: string[] }   // equal tasks only
export interface Workspace { …; ledgers: Record<LoadKind, Ledger> }
```

`taOrder` is present exactly on Equal tasks: a non-empty list of distinct TA ids, in rotation order.
Light and heavy tasks never carry it. `ledgers` keeps its two entries; Equal has no ledger and no
turn counter, because its fairness is fully determined by the task's own seats.

On an Equal seat, `turn` is the **round number**: the number of seats that TA holds in this task
once this one is counted (A's first date is round 1, A's second date is round 2). It is informational
only; no ledger reads it. `emptyWorkspace()` is unchanged.

## 2. Engine

### 2.1 Dealing an Equal task (`dealEqual`)

```ts
dealEqual({ order: string[]; occurrences: PendingOccurrence[]; taCount: number; held: Occurrence[] })
  → Occurrence[]
```

`held` are the task's occurrences that are not being dealt (a refill keeps them); for a fresh deal it
is `[]`. Let `count[ta]` be the number of seats `ta` holds across `held`, the kept seats of pending
occurrences, and the seats dealt so far in this call.

For each pending occurrence in date order (ties: input order, stable), fill `taCount − seats.length`
seats one at a time:
1. `candidates` = TAs in `order` not already seated on this occurrence.
2. Pick the candidate with the smallest `count`; ties go to the one earliest in `order`.
3. `count[ta]++`, append `{ taId: ta, turn: count[ta] }`.

Output occurrence = `{ id, date, seats: [...kept, ...picked] }`. On a fresh 1-TA deal this is exactly
the rotation A, B, D, A, B, D. With `taCount` 2 and order A, B, D it gives (A, B), (D, A), (B, D), …,
so every TA still gets the same number of dates ±1. The same rule refills a removed TA's dates
without touching anyone else's.

Up-front checks, before any occurrence is dealt, so a failed deal changes nothing:
- `order.length === 0` → `ValidationError("Add TAs on the Team page first.")` from the wizard; from
  `removeTA` → `ValidationError(`"${title}" has no TA left to cover its dates.`)`.
- `order.length < taCount` → `NotEnoughTAsError(taCount, order.length, title?)` with Equal wording:
  `This task needs 3 TAs but only 2 are in its order.` / `"Lab" needs 2 TAs on each date but only 1 is
  in its order.` (`NotEnoughTAsError` gains a `reason: "sections" | "order"` field that selects the
  tail; the default stays `"sections"` so every existing message is unchanged.)

### 2.2 Commands

`dealFor(task, …)` (the reducer's one dealing entry point) dispatches on `task.kind`: load kinds call
`assignOccurrences` with the kind's ledger as today; Equal calls `dealEqual` with `task.taOrder` and
leaves `ledgers` untouched.

| command | change |
|---|---|
| `createTask` | gains `taOrder?: string[]`. For `kind: "equal"` it is required: an array of distinct ids of existing TAs, else `ValidationError("Pick the TA order for an equal task.")`. For load kinds it is ignored and not stored. `taCount` validation unchanged. Deals with `dealEqual`; may throw the §2.1 errors. |
| `updateTask` | a schedule edit re-deals from scratch over `task.taOrder` (fresh seats, `held: []`). The order cannot be changed (not in the command). |
| `deleteTask` | Equal: just removes the task; no refund. |
| `redistributeTask`, `redistributeAll`, `setSemester` (extend) | Equal tasks are re-dealt from scratch over their saved order, in creation order, independent of the ledgers. `redistributeAll` still resets both ledgers and stays atomic. `setSemester` truncate: dropped occurrences are removed; no refund for Equal. |
| `removeTA` | Load kinds unchanged. Then, for each Equal task that lists the TA: `taOrder` = order without the TA (the task's other fields untouched); the §2.1 up-front checks run with the task's title; the removed TA's seats are refilled with `dealEqual({ order, occurrences: orphaned occurrences with the TA's seat dropped, taCount, held: the task's untouched occurrences })`. Equal tasks that do not list the TA are unchanged. If anything throws, the command throws and nothing changes. |
| `swapOccurrences`, `reassignOccurrence` | unchanged: same-kind rule, so Equal seats trade with Equal seats. On Equal seats the ledger branch is skipped (`isLoadKind`), and the seats trade `taId` and `turn` as today. |
| `addTA`, section commands | unchanged. A new TA is not added to any existing `taOrder`. |

`describe()`: `createTask` already reads `cmd.kind` → `Added equal task "X"`. Others unchanged.

### 2.3 Capacity

`capacities`, `turnSize`, `remainingFraction`, `eligibleCount` unchanged; they only concern load
kinds. Dashboard code iterates `LOAD_KINDS` wherever it reads `ledgers`.

## 3. Stored data and validation

No upgrade step: a v1.3 document is already a valid v1.4 document (it has no Equal tasks).
`isCurrentTask` accepts `kind: "equal"` only with a `taOrder` that is a non-empty array of strings;
load-kind tasks are checked as today (`taOrder` is not required and, if present, is ignored). The
validator does not check that `taOrder` ids exist or that `seats.length === taCount` (a validator that
throws on a slightly off document would lock the user out). The Supabase store holds the document as
JSON: no schema change.

`readCommand` shape checks: `createTask` with `kind: "equal"` needs `taOrder` to be an array of
strings, else `null`, like the existing `kind` and `taCount` guards.

## 4. UI

### 4.1 New task wizard
- **Step 1.** The Kind control becomes Light / Heavy / Equal (`grid-cols-3`). The hint under it reads,
  for Equal: "Equal tasks go round the TAs in the order below, one date each, whatever their sections."
  For light and heavy the existing hint stays.
- **Order list** (Equal only, under the kind hint): a `TAOrderList` component (`components/tasks/`),
  one row per TA: position number, colour dot, name, and "Move up" / "Move down" `IconButton`s with
  accessible names `Move Sara up` / `Move Sara down`; the first row's up and the last row's down are
  disabled. Above the list, a ghost `Button` **"Team list order"** resets the list to `workspace.tas`
  order; it is disabled while the list already matches. The list starts in team order whenever the
  wizard opens or the kind changes to Equal. Rows are keyboard-operable (the buttons are real
  buttons); no drag and drop. With no TAs the list is replaced by "Add TAs on the Team page first."
  and Next is disabled.
- **TAs per date.** For Equal the stepper's cap is `max(1, workspace.tas.length)` and its hint reads
  "Each date is covered by this many TAs together, taken in turn from the order." (cap 1: "Add more
  TAs to co-staff dates."). Load kinds keep `eligibleCount` and today's copy.
- **Create command** sends `taOrder` (the list's current order, every TA) only for Equal.
- **Step 3 (preview).** The date rows are unchanged. For Equal the right column, headed "After this
  equal task", lists the TAs in order with their date count in this task (`Sara · 2 dates`) instead
  of load gauges, since Equal draws on no ledger. Errors render in the existing block.

### 4.2 Tasks page and task detail
- Filter chips: All / Light / Heavy / Equal (`?kind=equal`). Subtitle: `2 light · 1 heavy · 1 equal`.
  The empty-state copy already interpolates the kind.
- `KindBadge` renders "Equal" with the `equal` Badge tone.
- Task detail: under the summary line, Equal tasks show the order as a row of small chips in sequence
  (colour dot + name), labelled "Order". The occurrence table is unchanged.

### 4.3 Calendar, timeline, dashboard
- Pill kind dot and the `TurnHeader` strip pick their colour from a `KIND_DOT: Record<TaskKind,
  string>` map (`bg-light` / `bg-heavy` / `bg-equal`) instead of a light/heavy ternary. Accessible names
  already spell out `KIND_LABEL`.
- Timeline rows show the Equal badge via `KindBadge`.
- Dashboard: the two `TurnHeader` tiles and the two gauges per `TACard` iterate `LOAD_KINDS`; nothing
  is added for Equal. `TACard.counts: Record<TaskKind, number>` and its caption becomes
  `3 light · 1 heavy · 2 equal`. `taStats.used` is `Record<LoadKind, number>`.
- Swap sheet and calendar swap mode: unchanged rules (same kind), so Equal trades with Equal.

### 4.4 Theme
`--equal` joins `--light` and `--heavy` in `app.css` (light theme an amber around `#8a5a00`, dark
theme around `#f2c26b`), exposed as `--color-equal`, and `Badge` gains the tone
`equal: "bg-equal/15 text-equal"`. Both values must reach ≥ 4.5:1 as badge text on their 15% tint
over `--bg`, like the existing comments document for light and heavy.

### 4.5 Copy
- Settings "Redistribute everything" body: "(light, heavy and equal)".
- README: the Tasks feature line says "light, heavy or equal"; a new paragraph "Equal tasks" under the
  distribution rule explains the rotation, the chosen order, that sections are ignored, and that the
  order is fixed at creation.

## 5. Tests

**Engine** (`app/engine/__tests__`): `dealEqual` on six dates with order A, B, D gives A, B, D, A, B,
D with rounds 1, 1, 1, 2, 2, 2; `taCount` 2 seats distinct TAs and every TA ends within one date of
the others; ties follow order position, never the rng; `order.length < taCount` and an empty order
throw the exact messages; `createTask` with `kind: "equal"` requires a valid `taOrder`, ignores it for
load kinds, and leaves both ledgers unchanged; `removeTA` drops the TA from `taOrder`, refills only
their seats, keeps other seats, and is refused with the task's title when the order would be empty or
too short for `taCount`; `redistributeTask` / `redistributeAll` re-deal Equal tasks over their order
and `redistributeAll` still resets both ledgers; a schedule edit re-deals over the order; swaps
between Equal seats leave the ledgers alone; `describe` says `Added equal task`; `isCurrentWorkspace`
accepts a v1.3 document by reference, accepts an Equal task with an order and rejects one without.
All existing engine tests pass unchanged apart from `LOAD_KINDS` where they iterate ledgers.

**UI**: the kind control offers three options; choosing Equal shows the order list in team order,
up/down move a row and disable at the bounds, "Team list order" restores team order and disables when
matching; the create command carries `taOrder` for Equal only; the stepper cap follows `tas.length`
for Equal; the preview column lists per-TA date counts for Equal; the Tasks page filters on
`?kind=equal` and the subtitle counts it; the detail page shows the order; the pill dot and badge use
the `equal` tone; the dashboard renders two tiles and two gauges with an Equal task present and the
caption counts it; `readCommand` rejects an Equal create without `taOrder`.

## 6. Out of scope
Editing the order after creation; adding a later TA to existing Equal tasks; excluding TAs from the
order in the wizard (every TA is listed); a shared rotation across Equal tasks; weighting Equal dates
into the light or heavy ledgers.
