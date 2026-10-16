// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext, useState } from "react";
import { createRoutesStub, useFetchers } from "react-router";
import { CommandToasts } from "~/components/layout/CommandToasts";
import { Toaster } from "~/components/ui/Toast";
import { ToastProvider } from "~/lib/toast";
import { UNDO_FETCHER_KEY, useHistory } from "~/lib/use-history";
import { COMMAND_STALL_MS, CommandWatchContext, useCommand } from "~/lib/use-command";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const keys = new Set<string>();

function Adder() {
  const { submit } = useCommand();
  // Record every command fetcher key that goes in flight.
  for (const f of useFetchers()) if (f.key.startsWith("cmd:")) keys.add(f.key);
  return (
    <button type="button" onClick={() => submit({ type: "addTA", name: "A" })}>
      add
    </button>
  );
}

function Page() {
  const [shown, setShown] = useState(true);
  return (
    <CommandToasts>
      {shown && <Adder />}
      <button type="button" onClick={() => setShown(false)}>
        hide
      </button>
    </CommandToasts>
  );
}

test("useCommand submits with a unique fetcher key and the shell toasts once per result", async () => {
  const action = vi.fn(async () => ({ ok: true, version: 2, snapshotId: 1, label: 'Added TA "A"' }));
  const Stub = createRoutesStub([
    { path: "/", Component: Page },
    { path: "/api/command", action },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
      <Toaster />
    </ToastProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "add" }));
  expect(await screen.findByText('Added TA "A"')).toBeInTheDocument();
  // Later renders (revalidation, fetcher cleanup) must not toast the same result again.
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(screen.getAllByText('Added TA "A"')).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

  // A second command gets its own key and its own toast, even when the submitter unmounts.
  fireEvent.click(screen.getByRole("button", { name: "add" }));
  fireEvent.click(screen.getByRole("button", { name: "hide" }));
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(screen.getAllByText('Added TA "A"')).toHaveLength(2);
  expect(action).toHaveBeenCalledTimes(2);
  expect(keys.size).toBe(2);
});

function Settler({ onSettled, inlineError }: { onSettled: (r: unknown) => void; inlineError?: boolean }) {
  const { submit } = useCommand();
  const [key, setKey] = useState("");
  return (
    <>
      <button type="button" onClick={() => setKey(submit({ type: "addTA", name: "A" }, { onSettled, inlineError }))}>
        go
      </button>
      <output>{key}</output>
    </>
  );
}

function renderSettler(action: () => Promise<unknown>, onSettled: (r: unknown) => void, inlineError?: boolean) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CommandToasts><Settler onSettled={onSettled} inlineError={inlineError} /></CommandToasts> },
    { path: "/api/command", action },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
      <Toaster />
    </ToastProvider>,
  );
}

test("submit returns the fetcher key and onSettled gets the result once", async () => {
  const onSettled = vi.fn();
  renderSettler(async () => ({ ok: true, version: 2, snapshotId: 1, label: 'Added TA "A"' }), onSettled);
  fireEvent.click(await screen.findByRole("button", { name: "go" }));
  expect(document.querySelector("output")!.textContent).toMatch(/^cmd:/);
  expect(await screen.findByText('Added TA "A"')).toBeInTheDocument();
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(onSettled).toHaveBeenCalledTimes(1);
  expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ ok: true, label: 'Added TA "A"' }));
});

test("inlineError: a failure reaches onSettled without an error toast", async () => {
  const onSettled = vi.fn();
  renderSettler(async () => Response.json({ ok: false, message: "Nope." }, { status: 400 }), onSettled, true);
  fireEvent.click(await screen.findByRole("button", { name: "go" }));
  await waitFor(() => expect(onSettled).toHaveBeenCalledWith({ ok: false, message: "Nope." }));
  expect(screen.queryByText("Nope.")).not.toBeInTheDocument();
});

test.each([
  ["a 400", async () => Response.json({ ok: false, message: "Unknown TA." }, { status: 400 }), "Unknown TA."],
  ["a 500", async () => Response.json({ ok: false, message: "Something went wrong on the server. Please try again." }, { status: 500 }), "Something went wrong on the server. Please try again."],
])("%s result toasts exactly once", async (_, action, message) => {
  renderSettler(action, () => {});
  fireEvent.click(await screen.findByRole("button", { name: "go" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  await act(() => new Promise((r) => setTimeout(r, 80)));
  expect(screen.getAllByText(message)).toHaveLength(1);
});

test("a watched command that never starts is dropped after the stall guard", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const onSettled = vi.fn();
    function Announcer() {
      const watch = useContext(CommandWatchContext)!;
      return <button type="button" onClick={() => watch("cmd:ghost", { onSettled })}>ghost</button>;
    }
    const Stub = createRoutesStub([{ path: "/", Component: () => <CommandToasts><Announcer /></CommandToasts> }]);
    render(
      <ToastProvider>
        <Stub initialEntries={["/"]} />
        <Toaster />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "ghost" }));
    await act(async () => void vi.advanceTimersByTime(COMMAND_STALL_MS + 50));
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  } finally {
    vi.useRealTimers();
  }
});

test("a command toast's Undo rolls back to its snapshot and toasts the rollback with its own Undo", async () => {
  const history = vi.fn(async ({ request }: { request: Request }) => {
    const body = await request.json();
    return { ok: true, version: 3, snapshotId: body.snapshotId + 10 };
  });
  function UndoWatcher() {
    useHistory(UNDO_FETCHER_KEY);
    return null;
  }
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CommandToasts><UndoWatcher /><Adder /></CommandToasts> },
    { path: "/api/command", action: async () => ({ ok: true, version: 2, snapshotId: 7, label: 'Added TA "A"' }) },
    { path: "/api/history", action: history },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
      <Toaster />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "add" }));
  await screen.findByText('Added TA "A"');
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(await screen.findByText("Rolled back")).toBeInTheDocument();
  expect(history).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Rolled back").closest("[role=status]")).toHaveTextContent("Undo");
});

test("a command slower than the stall guard still settles exactly once with its real result", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const onSettled = vi.fn();
    renderSettler(
      () => new Promise((r) => setTimeout(() => r({ ok: true, version: 2, snapshotId: 1, label: "Slow but fine" }), COMMAND_STALL_MS + 1500)),
      onSettled,
    );
    fireEvent.click(await screen.findByRole("button", { name: "go" }));
    await act(async () => void vi.advanceTimersByTime(COMMAND_STALL_MS + 100));
    expect(onSettled).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(2000));
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ ok: true, label: "Slow but fine" }));
    expect(screen.getAllByText("Slow but fine")).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});
