import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Sheet } from "~/components/ui/Sheet";
import type { Occurrence, OccurrenceRef, TA, Task } from "~/engine/types";
import { useStepFocus } from "~/lib/focus";
import { fmtDateLong } from "~/lib/format";
import { EASE_OUT, stepSlide, usePressMotion } from "~/lib/motion";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

type SwapSheetProps = { open: boolean; onClose: () => void; ta: TA };
type Group = { task: Task; occurrences: Occurrence[] };

const OPTION =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent";

/** Tasks with their occurrences matching `keep`, by date; tasks with none are dropped. */
function groupByTask(tasks: Task[], keep: (o: Occurrence) => boolean): Group[] {
  return tasks
    .map((task) => ({ task, occurrences: task.occurrences.filter(keep).sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter((g) => g.occurrences.length > 0);
}

function OccurrenceList({
  groups,
  taById,
  showOwner,
  onPick,
}: {
  groups: Group[];
  taById: Map<string, TA>;
  showOwner: boolean;
  onPick: (ref: OccurrenceRef) => void;
}) {
  const press = usePressMotion();
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ task, occurrences }, gi) => (
        <section key={task.id} aria-label={task.title}>
          <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{task.title}</h3>
          <ul>
            {occurrences.map((o, oi) => {
              const owner = taById.get(o.taId);
              return (
                <li key={o.id}>
                  <motion.button
                    type="button"
                    whileTap={press.whileTap}
                    data-autofocus={gi === 0 && oi === 0 ? true : undefined}
                    onClick={() => onPick({ taskId: task.id, occurrenceId: o.id })}
                    className={OPTION}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="sr-only">{task.title}, </span>
                      {fmtDateLong(o.date)}
                    </span>
                    {showOwner && owner && (
                      <span className="flex shrink-0 items-center gap-1.5 text-muted">
                        <span aria-hidden className="size-2.5 rounded-full" style={{ background: owner.color }} />
                        {owner.name}
                      </span>
                    )}
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Lives inside the Sheet, so the picked occurrence resets each time the sheet opens. */
function SwapPicker({ ta, onSwap, onCancel }: { ta: TA; onSwap: (a: OccurrenceRef, b: OccurrenceRef) => void; onCancel: () => void }) {
  const { workspace, taById } = useWorkspace();
  const reduced = useReducedMotion();
  const [first, setFirst] = useState<OccurrenceRef | null>(null);
  const [dir, setDir] = useState(1);
  const stepFocus = useStepFocus();

  const mine = groupByTask(workspace.tasks, (o) => o.taId === ta.id);
  const others = groupByTask(workspace.tasks, (o) => o.taId !== ta.id);
  const step = first === null ? 0 : 1;
  const firstTask = first && workspace.tasks.find((t) => t.id === first.taskId);
  const firstOcc = firstTask?.occurrences.find((o) => o.id === first?.occurrenceId);

  const pickFirst = (ref: OccurrenceRef) => {
    setDir(1);
    stepFocus.request();
    setFirst(ref);
  };
  const back = () => {
    setDir(-1);
    stepFocus.request();
    setFirst(null);
  };

  if (mine.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted">{ta.name} has no dates to swap yet.</p>
        <Button variant="ghost" data-autofocus onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {step === 0
          ? `Step 1 of 2: pick one of ${ta.name}'s dates.`
          : `Step 2 of 2: trade ${firstTask?.title ?? "it"}${firstOcc ? ` (${fmtDateLong(firstOcc.date)})` : ""} with another TA's date.`}
      </p>
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            ref={stepFocus.ref}
            custom={dir}
            variants={reduced ? undefined : stepSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.2, ease: EASE_OUT }}
          >
            {first === null ? (
              <OccurrenceList groups={mine} taById={taById} showOwner={false} onPick={pickFirst} />
            ) : others.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No other TA has a date to trade.</p>
            ) : (
              <OccurrenceList groups={others} taById={taById} showOwner onPick={(b) => onSwap(first, b)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={step === 0 ? onCancel : back}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
      </div>
    </div>
  );
}

/** Two-step trade: one of this TA's occurrences ↔ another TA's occurrence. Turn usage is unchanged. */
export function SwapSheet({ open, onClose, ta }: SwapSheetProps) {
  // Held here (not in SwapPicker) so the result toast still shows after the sheet closes.
  const { submit } = useCommand();
  return (
    <Sheet open={open} onClose={onClose} title={`Swap a date · ${ta.name}`}>
      <SwapPicker
        ta={ta}
        onCancel={onClose}
        onSwap={(a, b) => {
          submit({ type: "swapOccurrences", a, b });
          onClose();
        }}
      />
    </Sheet>
  );
}
