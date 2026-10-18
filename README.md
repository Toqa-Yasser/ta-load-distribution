# TA Load Distribution

A small web app for sharing recurring course tasks (quiz grading, proctoring, office hours…) fairly
among teaching assistants. You set up the TAs and the sections they cover, create tasks with a
schedule, and the app deals every dated occurrence out so the load follows how many sections each TA
covers. Every change is snapshotted, so you can undo or roll back.

## Features

- **Dashboard**: the current turn, a liquid gauge per TA (used / capacity), upcoming dates, and a
  two-step swap of one TA's date with another's.
- **Team**: add, rename and remove TAs; create sections and drag (or tap) TAs into each section's two slots.
- **Tasks**: light, heavy or equal (light and heavy each have their own fairness counter; equal goes round the TAs in an order you choose; 1 or more TAs per date); three-step creation (name → schedule → preview of who gets each date) with one-time, daily,
  weekly, monthly or custom schedules; redistribute or delete a task; a task detail page.
- **Calendar**: month grid of every occurrence; swap two dates between TAs.
- **History**: a snapshot per change, with rollback, toast Undo, and a password-protected "delete history".
- **Settings**: semester dates, light/dark/system theme, "redistribute everything" and "reset everything".
- Mobile-first: bottom tabs, centred pop-in dialogs, ≥44px targets, and every animation turned off
  under `prefers-reduced-motion`.

## The distribution rule

Each TA's **capacity** is the number of section slots they hold, and a **turn** is the sum of all
capacities. Occurrences are dealt in date order, one unit each. Every occurrence goes to the TA with
the **highest remaining fraction** of their capacity in this turn (`(capacity - used) / capacity`).
**Ties are broken at random**. When everyone who could take the next seat is full, the turn ends and
usage **resets** for the next turn, so a turn is never over-full even when a date needs several TAs. So a TA with two sections gets twice as many dates as a TA with one, and nobody falls behind. The rule runs separately per task kind (light and heavy), and both kinds share section capacity.

### TAs per date

A task can need two or more TAs on each date. Every one of them is charged one unit, so a 2-TA task
costs twice as much as a 1-TA task. The count is fixed when the task is created. Creating or
redistributing fails with a clear message when fewer TAs hold section slots than the task needs;
when the failure comes from removing a TA or redistributing, the message names the task.

### Equal tasks

An Equal task ignores sections and deals its dates round-robin over the TA order you pick when you
create the task, so with TAs A, B and D the dates go A, B, D, A, B, D. Every TA on the Team page is
listed in the wizard, and the "Team list order" button resets the order to the Team page's. A second
Equal task starts again from its own first TA. The order is fixed at creation, so a TA added later
does not join existing Equal tasks. When you remove a TA, their dates in an Equal task go to whoever
in the order has the fewest dates in that task (ties go to the earlier TA in the order).

## Local development

```sh
npm install
DATA_STORE=memory npm run dev   # in-memory store, no Supabase needed
```

Open http://localhost:5173. The memory store lasts as long as the dev server. Without
`DATA_STORE=memory`, the app uses Supabase when `SUPABASE_URL` is set (see below).

## Environment variables

Copy `.env.example` to `.env`. Everything is read on the server only (`app/server/*.server.ts`).
Nothing is sent to the browser.

| Variable                  | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `SUPABASE_URL`            | Project URL, e.g. `https://xxxx.supabase.co`                             |
| `SUPABASE_SECRET_KEY`     | Supabase **secret** key (`sb_secret_…`): server-only, never commit it    |
| `HISTORY_DELETE_PASSWORD` | Password required to delete the snapshot history                         |
| `DATA_STORE`              | Optional: `memory` or `supabase`. Defaults to `supabase` when `SUPABASE_URL` is set, and always in production |
| `APP_TIMEZONE`            | Optional IANA timezone for "today" (e.g. `Africa/Cairo`, the default)    |
| `APP_URL`                 | Public origin for canonical and Open Graph URLs (`og:url`, `og:image`). Falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL` on Vercel, else `http://localhost:5173`; set it to the production URL on Vercel |

## Supabase setup

1. Create a Supabase project.
2. Apply the schema in `supabase/migrations/0001_init.sql`. Paste it into the SQL editor, or run
   `supabase db push` with the Supabase CLI linked to the project.
3. Put the project URL and a secret key (Settings → API Keys) in `.env`.

The schema holds a single versioned `workspace` row (optimistic concurrency) and a `snapshots` table for history.

## Tests and checks

```sh
npm test            # Vitest: engine, server, components
npm run typecheck   # route typegen + tsc
npm run build
```

## Icons and social image

The mark lives in `public/icon.svg` (and as `app/components/ui/BrandMark.tsx` for the header). The raster
files (`favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `og.png`) are rendered
from it with headless Chrome, with no extra dependencies:

```sh
node scripts/icons.mjs   # CHROME_PATH=/path/to/chrome to use a browser other than Google Chrome on macOS
```

Rerun it after changing the SVG and commit the regenerated files. `og.png` loads Sora from Google Fonts,
so run it online.

## Deploying to Vercel

The Vercel preset is already configured in `react-router.config.ts` (`@vercel/react-router`), so no
`vercel.json` is needed.

1. Import the repository in Vercel. The framework is detected as React Router.
2. Under Project → Settings → Environment Variables, set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
   and `HISTORY_DELETE_PASSWORD`, plus `APP_URL` set to the production URL (e.g.
   `https://your-app.vercel.app`) so link previews and canonical URLs point at it (optionally `APP_TIMEZONE`).
3. Deploy.

Without `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, a production deploy refuses to start (every
request fails with a clear error) rather than silently keeping data in memory. `DATA_STORE=memory`
is for development only: its data is lost on every restart.

`.npmrc` sets `legacy-peer-deps=true`. The Vercel preset's peer range doesn't list React Router 8
yet, and this lets `npm install` succeed both locally and on Vercel. Keep the file.
