import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/tasks";
import { NewTaskSheet } from "~/components/tasks/NewTaskSheet";
import { TaskCard } from "~/components/tasks/TaskCard";
import { Button } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { plural } from "~/lib/format";
import { usePressMotion } from "~/lib/motion";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tasks · TA Load Distribution" }];
}

export default function Tasks() {
  const { workspace } = useWorkspace();
  const { submit } = useCommand();
  const press = usePressMotion();
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
  const tasks = workspace.tasks;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">Tasks</h1>
          <p className="mt-1 text-muted">{plural(tasks.length, "task", "tasks")}</p>
        </div>
        {/* Mobile uses the floating button below instead. */}
        <div className="hidden md:block">
          <Button onClick={() => setSheet(true)}>
            <PlusIcon /> New task
          </Button>
        </div>
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ChecklistIcon />}
          title="No tasks yet"
          body="Create a task and preview who gets each date before you confirm."
          action={{ label: "New task", onClick: () => setSheet(true) }}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
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

      {/* Mobile: floating action button above the tab bar. */}
      <motion.button
        type="button"
        {...press}
        aria-label="New task"
        onClick={() => setSheet(true)}
        className="fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-[0_10px_30px_-8px_var(--accent)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
      >
        <PlusIcon />
      </motion.button>

      <NewTaskSheet open={sheetOpen} onClose={() => setSheet(false)} />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12.2l2.3 2.3 4.7-4.9" />
    </svg>
  );
}
