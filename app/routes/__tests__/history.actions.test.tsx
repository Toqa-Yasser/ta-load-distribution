// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { Toaster } from "~/components/ui/Toast";
import { ToastProvider } from "~/lib/toast";
import History from "~/routes/history";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const snapshots = [{ id: 1, name: null, label: 'Added TA "A"', kind: "auto", version: 1, createdAt: "2026-10-17T09:00:00Z" }];

function setup(handle: (body: { intent: string; password?: string }) => Promise<unknown>) {
  const action = vi.fn(async ({ request }: { request: Request }) => handle(await request.json()));
  const Stub = createRoutesStub([
    { path: "/history", Component: History as never, loader: () => ({ snapshots, version: 2 }) },
    { path: "/api/history", action },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/history"]} />
      <Toaster />
    </ToastProvider>,
  );
  return action;
}

test("saving a snapshot and rolling back at the same time both report their result", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  setup(async (body) => {
    if (body.intent === "snapshot") {
      await gate;
      return { ok: true, snapshotId: 9 };
    }
    return { ok: true, version: 3, snapshotId: 10 };
  });
  fireEvent.change(await screen.findByLabelText("Snapshot name"), { target: { value: "Before exam" } });
  fireEvent.click(screen.getByRole("button", { name: "Save snapshot" }));
  fireEvent.click(screen.getByRole("button", { name: "Roll back" }));
  fireEvent.click(within(await screen.findByRole("dialog", { name: "Roll back?" })).getByRole("button", { name: "Roll back" }));
  expect(await screen.findByText("Rolled back")).toBeInTheDocument();
  await act(async () => release());
  expect(await screen.findByText("Snapshot saved")).toBeInTheDocument();
});

test("a wrong password keeps the dialog open with the server's message; the right one closes it", async () => {
  setup(async (body) =>
    body.password === "secret" ? { ok: true } : Response.json({ ok: false, message: "Wrong password." }, { status: 403 }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Delete history" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete history" });
  const input = within(dialog).getByLabelText("Password");
  fireEvent.change(input, { target: { value: "nope" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete all history" }));
  expect(await within(dialog).findByText("Wrong password.")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Delete history" })).toBeInTheDocument();
  // A failed delete is shown inline only, never as a toast too.
  expect(screen.getAllByText("Wrong password.")).toHaveLength(1);

  fireEvent.change(input, { target: { value: "secret" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete all history" }));
  expect(await screen.findByText("History deleted")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete history" })).not.toBeInTheDocument());
});
