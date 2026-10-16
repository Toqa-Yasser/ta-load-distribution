import { Link, useParams } from "react-router";
import type { Route } from "./+types/task-detail";
import { SplitBar } from "~/components/tasks/SplitBar";
import { Card } from "~/components/ui/Card";
import { Select } from "~/components/ui/Select";
import { fmtDateLong, fmtScheduleSummary, plural } from "~/lib/format";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Task · TA Load Distribution" }];
}

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

export default function TaskDetail() {
  const { taskId } = useParams();
  const { workspace } = useWorkspace();
  const { submit } = useCommand();
  const task = workspace.tasks.find((t) => t.id === taskId);

  // Read from the root data rather than a loader; a deleted or undone task lands here too.
  if (!task) {
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

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">{task.title}</h1>
          <p className="mt-1 text-muted">
            {fmtScheduleSummary(task.schedule, workspace.semester)} · {plural(task.occurrences.length, "occurrence", "occurrences")}
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
                      value={o.taId}
                      onChange={(e) => {
                        // Re-picking the current TA is a no-op; send nothing.
                        if (e.target.value !== o.taId)
                          submit({ type: "reassignOccurrence", ref: { taskId: task.id, occurrenceId: o.id }, taId: e.target.value });
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
