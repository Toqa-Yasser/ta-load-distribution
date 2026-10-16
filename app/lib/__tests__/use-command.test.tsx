// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createRoutesStub, useFetchers } from "react-router";
import { CommandToasts } from "~/components/layout/CommandToasts";
import { Toaster } from "~/components/ui/Toast";
import { ToastProvider } from "~/lib/toast";
import { useCommand } from "~/lib/use-command";

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
