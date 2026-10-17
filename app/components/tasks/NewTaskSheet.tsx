import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/Button";
import { Sheet } from "~/components/ui/Sheet";
import type { Command, Schedule, TaskKind, Workspace } from "~/engine/types";
import { messageOf } from "~/lib/errors";
import { useStepFocus } from "~/lib/focus";
import { EASE_OUT, indicatorSpring, stepSlide } from "~/lib/motion";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";
import { StepName } from "./StepName";
import { StepPreview } from "./StepPreview";
import { scheduleDates, StepSchedule } from "./StepSchedule";

type NewTaskSheetProps = { open: boolean; onClose: () => void; initialKind?: TaskKind };
type CreateTask = Extract<Command, { type: "createTask" }>;
type PreviewResult = { ok: true; workspace: Workspace } | { ok: false; message: string };
type Step = 0 | 1 | 2;

const STEP_TITLES = ["Name", "Schedule", "Preview"] as const;

function StepDots({ step }: { step: Step }) {
  const reduced = useReducedMotion();
  return (
    <ol aria-label={`Step ${step + 1} of 3: ${STEP_TITLES[step]}`} className="flex items-center gap-2">
      {STEP_TITLES.map((t, i) => (
        <li key={t} aria-hidden className="relative h-2 w-6 rounded-full bg-ink/10">
          {i === step && (
            <motion.span
              layoutId="new-task-step"
              transition={reduced ? { duration: 0 } : indicatorSpring}
              className="absolute inset-0 rounded-full bg-accent"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * The three steps. Lives inside the Sheet, so its state starts fresh each time the sheet opens.
 * Confirm keeps the sheet open until the create command settles: success closes it (the shell
 * toasts with Undo), a failure is shown here instead of in a toast.
 */
function Wizard({ open, initialKind, onDone, onCancel }: { open: boolean; initialKind: TaskKind; onDone: () => void; onCancel: () => void }) {
  const { today, workspace } = useWorkspace();
  const reduced = useReducedMotion();
  const [state, setState] = useState<{ step: Step; kind: TaskKind; title: string; notes: string; schedule: Schedule }>({
    step: 0,
    kind: initialKind,
    title: "",
    notes: "",
    schedule: { type: "weekly", start: today, end: null },
  });
  const [dir, setDir] = useState(1);
  const stepFocus = useStepFocus();
  const preview = useFetcher<PreviewResult>();
  // fetcher.data still holds the previous answer while a new preview is in flight.
  const [staleData, setStaleData] = useState<PreviewResult | undefined>(undefined);
  const { submit } = useCommand();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Closed mid-request (Escape, scrim, X, drag, Back): the result belongs to the shell's toast
  // only — no inline error, and no onDone, which would navigate from a possibly stale route. While
  // the sheet animates out, AnimatePresence keeps rendering the old element (open still true),
  // so the exit is read from useIsPresent; the unmount cleanup covers closes without an exit.
  const present = useIsPresent();
  const openRef = useRef(open);
  openRef.current = open && present;
  // Unmounted without a render at open=false (no exit animation): treat as closed too.
  useEffect(
    () => () => {
      openRef.current = false;
    },
    [],
  );

  const confirm = () => {
    setCreating(true);
    setCreateError(null);
    submit(command(), {
      inlineError: () => openRef.current,
      onSettled: (r) => {
        setCreating(false);
        if (!openRef.current) return;
        if (r.ok) onDone();
        else setCreateError(r.message);
      },
    });
  };

  const { step, kind, title, notes, schedule } = state;
  const command = (): CreateTask => ({
    type: "createTask",
    kind,
    title: title.trim(),
    ...(notes.trim() ? { notes: notes.trim() } : {}),
    schedule,
  });

  const valid = step === 0 ? title.trim() !== "" : step === 1 ? scheduleDates(schedule, workspace.semester).error === null : true;

  const go = (next: Step) => {
    if (next === 2) {
      setStaleData(preview.data);
      // Runs the reducer on the server without saving.
      preview.submit(JSON.stringify({ command: command() }), {
        method: "post",
        action: "/api/preview",
        encType: "application/json",
      });
    }
    setCreateError(null);
    setDir(next > step ? 1 : -1);
    stepFocus.request();
    setState((s) => ({ ...s, step: next }));
  };
  const next = () => valid && step < 2 && go((step + 1) as Step);

  const loading = step === 2 && (preview.state !== "idle" || preview.data === staleData);
  const result = loading ? undefined : preview.data;
  const error = result === undefined || result.ok === true ? null : messageOf(result);
  const previewWs = result?.ok === true ? result.workspace : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <StepDots step={step} />
        <span className="text-sm text-muted">{STEP_TITLES[step]}</span>
      </div>

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
            {step === 0 && (
              <StepName
                kind={kind}
                title={title}
                notes={notes}
                onChange={(v) => setState((s) => ({ ...s, ...v }))}
                onSubmit={next}
              />
            )}
            {step === 1 && (
              <StepSchedule
                schedule={schedule}
                semester={workspace.semester}
                onChange={(v) => setState((s) => ({ ...s, schedule: v }))}
              />
            )}
            {step === 2 && <StepPreview preview={previewWs} taskTitle={title.trim()} loading={loading} error={error} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {createError && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          {createError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={creating} onClick={step === 0 ? onCancel : () => go((step - 1) as Step)}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < 2 ? (
          <Button disabled={!valid} onClick={next}>
            Next
          </Button>
        ) : (
          <Button disabled={!previewWs} loading={loading || creating} onClick={confirm}>
            Confirm
          </Button>
        )}
      </div>
    </div>
  );
}

/** Three-step task creation (name → schedule → preview of who gets each date). */
export function NewTaskSheet({ open, onClose, initialKind = "light" }: NewTaskSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="New task">
      <Wizard open={open} initialKind={initialKind} onCancel={onClose} onDone={onClose} />
    </Sheet>
  );
}
