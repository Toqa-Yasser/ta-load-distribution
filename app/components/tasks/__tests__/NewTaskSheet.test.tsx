// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const wsTwo: Workspace = {
  ...ws,
  tas: [...ws.tas, { id: "B", name: "Bassem", color: "#0f0" }],
  sections: [{ id: "S1", name: "S1", taIds: ["A", "B"] }],
};
const wsOne: Workspace = { ...wsTwo, sections: [{ id: "S1", name: "S1", taIds: ["A", null] }] };
// The workspace the mock hands out; tests swap it to change the eligible TA count.
const current = { ws };
vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: current.ws, today: "2026-10-17", taById: new Map() }) }));
afterEach(() => {
  current.ws = ws;
});

const previewOf = (title: string): Workspace => {
  const task: Task = { id: "n", title, kind: "light", createdAt: "", taCount: 1, schedule: { type: "one-time", date: "2026-10-20" },
    occurrences: [{ id: "o", date: "2026-10-20", seats: [{ taId: "A", turn: 1 }] }] };
  return { ...ws, tasks: [task] };
};

type Deferred = { promise: Promise<unknown>; resolve: (v: unknown) => void };
const deferred = (): Deferred => {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

const bodies = { preview: [] as Record<string, unknown>[], command: [] as Record<string, unknown>[] };

function setup({ command, preview }: { command?: () => Promise<unknown>; preview?: (title: string) => Promise<unknown> }) {
  bodies.preview = [];
  bodies.command = [];
  const onClose = vi.fn();
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CommandToasts><NewTaskSheet open onClose={onClose} /></CommandToasts> },
    {
      path: "/api/preview",
      action: async ({ request }) => {
        const { command: cmd } = await request.json();
        bodies.preview.push(cmd);
        return preview ? preview(cmd.title) : { ok: true, workspace: previewOf(cmd.title) };
      },
    },
    {
      path: "/api/command",
      action: async ({ request }) => {
        bodies.command.push(await request.json());
        return command ? command() : { ok: true, version: 2, snapshotId: 1, label: "Created" };
      },
    },
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

test("NewTaskSheet sends taCount in createTask", async () => {
  current.ws = wsTwo;
  setup({});
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Quiz" } });
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuenow", "2");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("radio", { name: "One-time" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const confirm = await screen.findByRole("button", { name: "Confirm" });
  await waitFor(() => expect(confirm).toBeEnabled());
  expect(bodies.preview[0]).toMatchObject({ type: "createTask", taCount: 2 });
  fireEvent.click(confirm);
  await waitFor(() => expect(bodies.command).toHaveLength(1));
  expect(bodies.command[0]).toMatchObject({ command: { type: "createTask", taCount: 2 } });
});

test("taCount is clamped to the eligible count", async () => {
  current.ws = wsTwo;
  setup({});
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Quiz" } });
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuenow", "2");
  // A TA loses their section while the wizard is open; the next render sees only one eligible TA.
  current.ws = wsOne;
  fireEvent.click(screen.getByRole("radio", { name: "Heavy" }));
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuenow", "1");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("radio", { name: "One-time" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(bodies.preview).toHaveLength(1));
  expect(bodies.preview[0]).toMatchObject({ taCount: 1 });
});

test("a NotEnoughTAsError from the preview renders in the preview error block", async () => {
  const message = "This task needs 2 TAs but only 1 has sections.";
  setup({ preview: async () => ({ ok: false, message, code: "NOT_ENOUGH_TAS" }) });
  await toPreview();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(message);
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
});

async function confirmAndSend() {
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("radio", { name: "One-time" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const confirm = await screen.findByRole("button", { name: "Confirm" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(bodies.command).toHaveLength(1));
}

test("an equal task sends taOrder in team order and caps TAs per date by the team size", async () => {
  current.ws = wsOne;
  setup({});
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Quiz" } });
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuemax", "1");
  fireEvent.click(screen.getByRole("radio", { name: "Equal" }));
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuemax", "2");
  expect(screen.getByRole("list", { name: "Order" })).toBeInTheDocument();
  await confirmAndSend();
  expect(bodies.preview[0]).toMatchObject({ type: "createTask", kind: "equal", taOrder: ["A", "B"] });
  expect(bodies.command[0]).toMatchObject({ command: { type: "createTask", kind: "equal", taOrder: ["A", "B"] } });
});

test("a light task sends no taOrder", async () => {
  current.ws = wsTwo;
  setup({});
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Quiz" } });
  await confirmAndSend();
  expect(bodies.preview[0]).toMatchObject({ kind: "light" });
  expect(bodies.preview[0]).not.toHaveProperty("taOrder");
  expect(bodies.command[0].command).not.toHaveProperty("taOrder");
});

test("the order sent is reconciled with the current team", async () => {
  current.ws = wsTwo;
  setup({});
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Quiz" } });
  fireEvent.click(screen.getByRole("radio", { name: "Equal" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Ahmed down" }));
  // Ahmed leaves and Carla joins while the wizard is open; the next render sees the new team.
  current.ws = { ...wsTwo, tas: [wsTwo.tas[1], { id: "C", name: "Carla", color: "#00f" }] };
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Quiz 2" } });
  const items = within(screen.getByRole("list", { name: "Order" })).getAllByRole("listitem");
  expect(items.map((li) => li.textContent)).toEqual(["1.Bassem", "2.Carla"]);
  await confirmAndSend();
  expect(bodies.preview[0]).toMatchObject({ kind: "equal", taOrder: ["B", "C"] });
  expect(bodies.command[0]).toMatchObject({ command: { kind: "equal", taOrder: ["B", "C"] } });
});

test("with no TAs the order list is replaced by the message and Next is disabled", async () => {
  current.ws = emptyWorkspace();
  setup({});
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Quiz" } });
  expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  fireEvent.click(screen.getByRole("radio", { name: "Equal" }));
  expect(screen.getByText("Add TAs on the Team page first.")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Order" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});
