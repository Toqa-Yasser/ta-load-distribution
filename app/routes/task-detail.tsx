import { data, isRouteErrorResponse, Link, useNavigate, useParams, type ShouldRevalidateFunction } from "react-router";
import type { Route } from "./+types/task-detail";
import { KindBadge } from "~/components/tasks/KindBadge";
import { SplitBar } from "~/components/tasks/SplitBar";
import { Card } from "~/components/ui/Card";
import { EmptyState } from "~/components/ui/EmptyState";
import { ChevronLeftIcon, TasksIcon } from "~/components/ui/icons";
import { fmtDateLong, fmtTaskSummary, plural } from "~/lib/format";
import { shouldRevalidateRoot } from "~/lib/revalidate";
import { stagger } from "~/lib/motion";
import { routeMeta } from "~/lib/seo";
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
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-field px-2 text-sm font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      <ChevronLeftIcon />
      Tasks
    </Link>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <EmptyState
        icon={<TasksIcon />}
        titleAs="h1"
        title="Task not found"
        body="It may have been deleted or undone."
        action={{ label: "Back to tasks", onClick: () => navigate("/tasks") }}
      />
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
  const { workspace, taById } = useWorkspace();
  const task = workspace.tasks.find((t) => t.id === taskId);

  // The loader 404s an unknown id; this covers the root data dropping the task (delete, undo)
  // between the loader's check and this render.
  if (!task) return <NotFound />;

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <header {...stagger(1, "rise", "flex flex-col gap-3")}>
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 break-words text-display font-semibold">{task.title}</h1>
            <KindBadge kind={task.kind} />
          </div>
          <p className="mt-1 text-muted">
            {fmtTaskSummary(task)} · {plural(task.occurrences.length, "occurrence", "occurrences")}
          </p>
          {task.taOrder && (
            <ol aria-label="Order" className="mt-2 flex flex-wrap items-center gap-2">
              {task.taOrder.map((id, i) => {
                const ta = taById.get(id);
                return (
                  <li
                    key={`${id}-${i}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-sm"
                  >
                    <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta?.color ?? "var(--muted)" }} />
                    <span className={ta ? undefined : "text-muted"}>{ta?.name ?? "Removed TA"}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {task.notes && <p className="mt-2 whitespace-pre-line">{task.notes}</p>}
        </div>
        <SplitBar occurrences={task.occurrences} tas={workspace.tas} legend />
      </header>

      <div {...stagger(2)}>
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
            {/* Who holds each date is read-only here: dates change hands only by swapping. */}
            {task.occurrences.map((o) => {
              return (
                <tr key={o.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 tabular-nums">{fmtDateLong(o.date)}</td>
                  <td className="w-1/2 px-4 py-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {o.seats.map((seat) => {
                        const ta = taById.get(seat.taId);
                        return (
                          <span key={seat.taId} className="inline-flex items-center gap-2">
                            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta?.color ?? "var(--muted)" }} />
                            <span className={ta ? undefined : "text-muted"}>{ta?.name ?? "Unassigned"}</span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      </div>
    </div>
  );
}
