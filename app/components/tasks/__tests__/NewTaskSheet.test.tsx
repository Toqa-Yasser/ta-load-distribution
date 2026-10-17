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

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

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

test("the sheet stays open while creating and closes once the command succeeds", async () => {
  const gate = deferred();
  const { onClose } = setup({ command: () => gate.promise });
  await toPreview();
  const confirm = await screen.findByRole("button", { name: "Confirm" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute("aria-busy", "true"));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => gate.resolve({ ok: true, version: 2, snapshotId: 1, label: 'Created task "Quiz"' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Created task "Quiz"')).toBeInTheDocument();
});

test("a failed create keeps the sheet open and shows the error inline, without a toast", async () => {
  const { onClose } = setup({ command: async () => Response.json({ ok: false, message: "Add a TA first." }, { status: 400 }) });
  await toPreview();
  const confirm = await screen.findByRole("button", { name: "Confirm" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  const alert = await screen.findByText("Add a TA first.");
  expect(alert.closest("[role=dialog]")).not.toBeNull();
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(screen.getAllByText("Add a TA first.")).toHaveLength(1);
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
});

test("going back and previewing again never shows the previous preview while the new one loads", async () => {
  const second = deferred();
  let calls = 0;
  setup({ preview: (title) => (++calls === 1 ? Promise.resolve({ ok: true, workspace: previewOf(title) }) : second.promise) });
  await toPreview("First");
  expect(await screen.findByRole("region", { name: "Occurrences" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  expect(await screen.findByLabelText("Loading preview")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Occurrences" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await act(async () => second.resolve({ ok: true, workspace: previewOf("First") }));
  expect(await screen.findByRole("region", { name: "Occurrences" })).toBeInTheDocument();
});

test("Next stays disabled for a schedule over the 500-date cap", async () => {
  ws.semester = { name: "Long", start: "2026-01-01", end: "2028-12-31" };
  try {
    setup({});
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Daily" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Daily" }));
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  } finally {
    ws.semester = emptyWorkspace().semester;
  }
});

function ToggleHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <CommandToasts>
      <NewTaskSheet open={open} onClose={() => { onClose(); setOpen(false); }} />
    </CommandToasts>
  );
}

test.each([
  ["succeeds", { ok: true, version: 2, snapshotId: 1, label: 'Created task "Quiz"' }, 'Created task "Quiz"'],
  ["fails", { ok: false, message: "Add a TA first." }, "Add a TA first."],
])("a create that %s after the sheet was closed does not close it again or show the error inline", async (_, result, toastText) => {
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
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => gate.resolve(result));
  // The shell's toast reports the result instead.
  expect(await screen.findByText(toastText)).toBeInTheDocument();
  await act(() => new Promise((r) => setTimeout(r, 30)));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByText(toastText)).toHaveLength(1);
});

test("initialKind pre-selects that kind in step one", async () => {
  const Stub = createRoutesStub([{ path: "/", Component: () => <NewTaskSheet open initialKind="heavy" onClose={() => {}} /> }]);
  render(<ToastProvider><Stub initialEntries={["/"]} /></ToastProvider>);
  expect(await screen.findByRole("radio", { name: /heavy/i })).toBeChecked();
});
