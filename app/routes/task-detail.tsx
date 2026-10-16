import { useState } from "react";
import { data, isRouteErrorResponse, Link, useParams, type ShouldRevalidateFunction } from "react-router";
import type { Route } from "./+types/task-detail";
import { KindBadge } from "~/components/tasks/KindBadge";
import { SplitBar } from "~/components/tasks/SplitBar";
import { Card } from "~/components/ui/Card";
import { Select } from "~/components/ui/Select";
import { fmtDateLong, fmtScheduleSummary, plural } from "~/lib/format";
import { shouldRevalidateRoot } from "~/lib/revalidate";
import { routeMeta } from "~/lib/seo";
import { useCommand } from "~/lib/use-command";
import { useWorkspace, type RootLoaderData } from "~/lib/use-workspace";
import { getStore } from "~/server/store.server";
import { loadWorkspace } from "~/server/workspace.server";

export function meta({ matches, params }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as RootLoaderData | undefined;
  const task = root?.workspace.tasks.find((t) => t.id === params.taskId);
  const name = task?.title ?? "Task";
  return routeMeta(matches, {
    title: `${name} · Tasks`,
    description: `${name} — occurrences and assignments.`,
    path: `/tasks/${encodeURIComponent(params.taskId ?? "")}`,
  });
}

/** Only checks the task exists, so an unknown id is a real 404; the page reads the root data. */
export async function loader({ params }: Route.LoaderArgs) {
  const { data: workspace } = await loadWorkspace(getStore());
  if (!workspace.tasks.some((t) => t.id === params.taskId)) throw data("Not found", { status: 404 });
  return null;
}

// Same rules as the root: previews and search-only changes cannot change whether the task exists.
export const shouldRevalidate: ShouldRevalidateFunction = shouldRevalidateRoot;

function BackLink() {
  return (
    <Link
      to="/tasks"
      className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Tasks
    </Link>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Task not found</h1>
        <p className="mt-1 text-muted">It may have been deleted or undone.</p>
      </Card>
    </div>
  );
}

/** The loader's 404 renders the friendly message in the shell; anything else is rethrown to the root. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  throw error;
}

export default function TaskDetail() {
  const { taskId } = useParams();
  const { workspace } = useWorkspace();
  const { submit } = useCommand();
  // occurrence id -> the TA just picked, shown until that command settles (after revalidation).
  const [picked, setPicked] = useState<ReadonlyMap<string, { taId: string; key: string }>>(new Map());
  const task = workspace.tasks.find((t) => t.id === taskId);

  // The loader 404s an unknown id; this covers the root data dropping the task (delete, undo)
  // between the loader's check and this render.
  if (!task) return <NotFound />;

  const reassign = (occurrenceId: string, taId: string) => {
    let key = "";
    const settle = () =>
      setPicked((m) => {
        if (m.get(occurrenceId)?.key !== key) return m; // a newer pick for this row is in flight
        const next = new Map(m);
        next.delete(occurrenceId);
        return next;
      });
    key = submit({ type: "reassignOccurrence", ref: { taskId: task.id, occurrenceId }, taId }, { onSettled: settle });
    setPicked((m) => new Map(m).set(occurrenceId, { taId, key }));
  };

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <header className="flex flex-col gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 break-words text-3xl font-semibold md:text-4xl">{task.title}</h1>
            <KindBadge kind={task.kind} />
          </div>
          <p className="mt-1 text-muted">
            {fmtScheduleSummary(task.schedule)} · {plural(task.occurrences.length, "occurrence", "occurrences")}
          </p>
          {task.notes && <p className="mt-2 whitespace-pre-line">{task.notes}</p>}
        </div>
        <SplitBar occurrences={task.occurrences} tas={workspace.tas} legend />
      </header>

      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                TA
              </th>
            </tr>
          </thead>
          <tbody>
            {task.occurrences.map((o) => {
              const label = fmtDateLong(o.date);
              return (
                <tr key={o.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2 tabular-nums">{label}</td>
                  <td className="w-1/2 px-4 py-2">
                    <Select
                      aria-label={`TA for ${label}`}
                      value={picked.get(o.id)?.taId ?? o.taId}
                      onChange={(e) => {
                        // Re-picking the shown TA is a no-op; send nothing.
                        if (e.target.value !== (picked.get(o.id)?.taId ?? o.taId)) reassign(o.id, e.target.value);
                      }}
                    >
                      {workspace.tas.map((ta) => (
                        <option key={ta.id} value={ta.id}>
                          {ta.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
