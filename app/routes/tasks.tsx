import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/tasks";
import { NewTaskSheet } from "~/components/tasks/NewTaskSheet";
import { TaskCard } from "~/components/tasks/TaskCard";
import { Button } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { Fab } from "~/components/ui/Fab";
import { PlusIcon, TasksIcon } from "~/components/ui/icons";
import { isTaskKind, KIND_LABEL, type TaskKind } from "~/engine/types";
import { plural } from "~/lib/format";
import { indicatorSpring, usePressMotion } from "~/lib/motion";
import { routeMeta } from "~/lib/seo";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta(matches, { title: "Tasks", description: "Create tasks and preview who gets each occurrence.", path: "/tasks" });
}

export default function Tasks() {
  const { workspace } = useWorkspace();
  const { submit } = useCommand();
  const reduced = useReducedMotion();
  // `?new=1` opens the sheet, so a refresh keeps it open.
  const [params, setParams] = useSearchParams();
  const sheetOpen = params.get("new") === "1";
  const setSheet = (open: boolean) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (open) next.set("new", "1");
        else next.delete("new");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const allTasks = workspace.tasks;
  // `?kind=light|heavy` filters; anything else shows every task.
  const rawKind = params.get("kind");
  const kindFilter: TaskKind | null = isTaskKind(rawKind) ? rawKind : null;
  const setKindFilter = (kind: TaskKind | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (kind) next.set("kind", kind);
        else next.delete("kind");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const tasks = kindFilter ? allTasks.filter((t) => t.kind === kindFilter) : allTasks;
  const lightCount = allTasks.filter((t) => t.kind === "light").length;
  const heavyCount = allTasks.length - lightCount;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">Tasks</h1>
          <p className="mt-1 text-muted">
            {allTasks.length === 0 ? plural(0, "task", "tasks") : `${lightCount} light · ${heavyCount} heavy`}
          </p>
        </div>
        {/* Mobile uses the floating button below instead. */}
        <div className="hidden md:block">
          <Button onClick={() => setSheet(true)}>
            <PlusIcon /> New task
          </Button>
        </div>
      </header>

      {allTasks.length > 0 && <KindFilter value={kindFilter} onChange={setKindFilter} />}

      {allTasks.length === 0 ? (
        <EmptyState
          icon={<TasksIcon />}
          title="No tasks yet"
          body="Create a task and preview who gets each date before you confirm."
          action={{ label: "New task", onClick: () => setSheet(true) }}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<TasksIcon />}
          title={`No ${kindFilter} tasks yet`}
          body={`Create a ${kindFilter} task, or look at every task.`}
          action={{ label: "Show all tasks", onClick: () => setKindFilter(null) }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
                className="h-full"
              >
                <TaskCard
                  task={task}
                  onRedistribute={() => submit({ type: "redistributeTask", taskId: task.id })}
                  onDelete={() => submit({ type: "deleteTask", taskId: task.id })}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Mobile: floating action button above the tab bar (portalled out of the animated page). */}
      <Fab label="New task" onClick={() => setSheet(true)}>
        <PlusIcon />
      </Fab>

      <NewTaskSheet open={sheetOpen} onClose={() => setSheet(false)} />
    </div>
  );
}

const FILTERS: { value: TaskKind | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "light", label: KIND_LABEL.light },
  { value: "heavy", label: KIND_LABEL.heavy },
];

/** All / Light / Heavy chips; the active chip's fill glides between them. */
function KindFilter({ value, onChange }: { value: TaskKind | null; onChange: (kind: TaskKind | null) => void }) {
  const press = usePressMotion();
  const reduced = useReducedMotion();
  return (
    <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = f.value === value;
        return (
          <motion.button
            key={f.label}
            type="button"
            {...press}
            aria-pressed={active}
            onClick={() => !active && onChange(f.value)}
            className={`relative isolate min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? "border-transparent text-white" : "border-line text-muted hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="task-kind-filter"
                transition={reduced ? { duration: 0 } : indicatorSpring}
                className="absolute inset-0 -z-10 rounded-full bg-accent"
              />
            )}
            {f.label}
          </motion.button>
        );
      })}
    </div>
  );
}

