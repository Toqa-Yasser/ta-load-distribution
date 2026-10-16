// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createRoutesStub } from "react-router";
import { CommandToasts } from "~/components/layout/CommandToasts";
import { NewTaskSheet } from "~/components/tasks/NewTaskSheet";
import { Toaster } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";
import type { Task, Workspace } from "~/engine/types";
import { ToastProvider } from "~/lib/toast";


const ws: Workspace = { ...emptyWorkspace(), tas: [{ id: "A", name: "Ahmed", color: "#f00" }] };
vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map() }) }));

const previewOf = (title: string): Workspace => {
  const task: Task = { id: "n", title, kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" },
    occurrences: [{ id: "o", date: "2026-10-20", taId: "A", turn: 1 }] };
  return { ...ws, tasks: [task] };
};

type Deferred = { promise: Promise<unknown>; resolve: (v: unknown) => void };
const deferred = (): Deferred => {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

function setup({ command, preview }: { command?: () => Promise<unknown>; preview?: (title: string) => Promise<unknown> }) {
  const onClose = vi.fn();
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CommandToasts><NewTaskSheet open onClose={onClose} /></CommandToasts> },
    {
      path: "/api/preview",
      action: async ({ request }) => {
        const { command: cmd } = await request.json();
        return preview ? preview(cmd.title) : { ok: true, workspace: previewOf(cmd.title) };
      },
    },
    { path: "/api/command", action: command ?? (async () => ({ ok: true, version: 2, snapshotId: 1, label: "Created" })) },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
      <Toaster />
    </ToastProvider>,
  );
  return { onClose };
}

async function toPreview(title = "Quiz") {
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: title } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("radio", { name: "One-time" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

function ToggleHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <CommandToasts>
      <NewTaskSheet open={open} onClose={() => { onClose(); setOpen(false); }} />
    </CommandToasts>
  );
}

// Real AnimatePresence: after Close the wizard is still mounted while the sheet animates out.
test("a failure that arrives while the closed sheet is still animating out is toasted, not shown inline", async () => {
  const gate = deferred();
  const onClose = vi.fn();
  const Stub = createRoutesStub([
    { path: "/", Component: () => <ToggleHarness onClose={onClose} /> },
    { path: "/api/preview", action: async () => ({ ok: true, workspace: previewOf("Quiz") }) },
    { path: "/api/command", action: () => gate.promise },
  ]);
  render(<ToastProvider><Stub initialEntries={["/"]} /><Toaster /></ToastProvider>);
  await toPreview();
  const confirm = await screen.findByRole("button", { name: "Confirm" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument(); // exiting, wizard still mounted
  await act(async () => gate.resolve({ ok: false, message: "Add a TA first." }));
  const shown = await screen.findAllByText("Add a TA first.");
  expect(shown).toHaveLength(1);
  expect(shown[0].closest("[role=dialog]")).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});
