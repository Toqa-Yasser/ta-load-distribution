import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { INPUT_CLASS } from "~/components/ui/input";
import { Button } from "~/components/ui/Button";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Field } from "~/components/ui/Field";
import { Sheet } from "~/components/ui/Sheet";
import type { Semester } from "~/engine/types";
import { indicatorSpring, usePressMotion } from "~/lib/motion";
import { useTheme, type ThemePref } from "~/lib/theme";
import { useCommand } from "~/lib/use-command";
import { useWorkspace } from "~/lib/use-workspace";

type SettingsPanelProps = { open: boolean; onClose: () => void };

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Slide-over with the semester dates, the theme and the workspace-wide danger actions. */
export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { workspace } = useWorkspace();
  const { submit, pending } = useCommand();
  const { pref, setPref } = useTheme();
  const reduced = useReducedMotion();
  const press = usePressMotion();
  const [draft, setDraft] = useState<Semester>(workspace.semester);
  const [confirm, setConfirm] = useState<"redistribute" | "reset" | null>(null);

  // Start from the saved semester each time the panel opens (and after a save lands).
  useEffect(() => {
    if (open) setDraft(workspace.semester);
  }, [open, workspace.semester]);

  const saved = workspace.semester;
  const datesInvalid = Boolean(draft.start && draft.end && draft.end < draft.start);
  const changed = draft.name !== saved.name || draft.start !== saved.start || draft.end !== saved.end;
  const canSave = changed && draft.name.trim() !== "" && Boolean(draft.start && draft.end) && !datesInvalid;

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    submit({ type: "setSemester", semester: { ...draft, name: draft.name.trim() } });
  };

  // The confirm stacks on top of the open panel; closing it hands focus back to the danger button
  // and leaves the panel's scroll lock in place. Never close both at once (see Sheet.test.tsx).
  const askDanger = (kind: "redistribute" | "reset") => setConfirm(kind);
  const runDanger = (kind: "redistribute" | "reset") => {
    submit(kind === "reset" ? { type: "reset" } : { type: "redistributeAll" });
    setConfirm(null);
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Settings" side="right">
        <div className="flex flex-col gap-6">
          <Section title="Semester">
            <form onSubmit={onSave} className="flex flex-col gap-3">
              <Field label="Name">
                <input
                  className={INPUT_CLASS}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <input
                    type="date"
                    className={INPUT_CLASS}
                    value={draft.start}
                    onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
                  />
                </Field>
                <Field
                  label="End"
                  hint="Task dates after the end are dropped."
                  error={datesInvalid ? "The end date must be on or after the start date." : undefined}
                >
                  <input
                    type="date"
                    className={INPUT_CLASS}
                    value={draft.end}
                    min={draft.start || undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
                  />
                </Field>
              </div>
              <Button type="submit" className="self-end" disabled={!canSave} loading={pending}>
                Save semester
              </Button>
            </form>
          </Section>

          <Section title="Appearance">
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-2xl border border-line p-1">
              {THEMES.map((t) => {
                const active = pref === t.value;
                return (
                  <motion.button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    whileTap={press.whileTap}
                    onClick={() => setPref(t.value)}
                    className={`relative isolate min-h-11 rounded-xl text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      active ? "text-ink" : "text-muted hover:bg-ink/5 hover:text-ink"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-theme-pill"
                        transition={reduced ? { duration: 0 } : indicatorSpring}
                        className="absolute inset-0 -z-10 rounded-xl border border-line bg-surface shadow-sm"
                      />
                    )}
                    {t.label}
                  </motion.button>
                );
              })}
            </div>
          </Section>

          <Section title="Danger zone">
            <div className="flex flex-col gap-3 rounded-2xl border border-accent-2/30 p-3">
              <DangerRow
                label="Redistribute everything"
                body="Deal every task out again from scratch."
                onClick={() => askDanger("redistribute")}
              />
              <DangerRow
                label="Reset everything"
                body="Clear all TAs, sections and tasks."
                onClick={() => askDanger("reset")}
              />
            </div>
          </Section>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirm === "redistribute"}
        title="Redistribute everything?"
        body="Every task will be dealt out again from scratch and the fairness counters reset. Existing assignments will change."
        confirmLabel="Redistribute"
        danger
        onConfirm={() => runDanger("redistribute")}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset everything?"
        body="A snapshot is saved first, so you can roll back from History."
        confirmLabel="Reset everything"
        danger
        onConfirm={() => runDanger("reset")}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function DangerRow({ label, body, onClick }: { label: string; body: string; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">{body}</p>
      <Button variant="danger" size="sm" className="shrink-0" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}
