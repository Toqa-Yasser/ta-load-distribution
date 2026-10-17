// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { SwapSheet } from "~/components/dashboard/SwapSheet";
import { CommandToasts } from "~/components/layout/CommandToasts";
import { ToastProvider } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";
import type { TA, Workspace } from "~/engine/types";

const A: TA = { id: "A", name: "Ahmed", color: "#f00" };
const B: TA = { id: "B", name: "Bassem", color: "#0f0" };
const C: TA = { id: "C", name: "Carla", color: "#00f" };
const ws: Workspace = {
  ...emptyWorkspace(),
  tas: [A, B, C],
  tasks: [
    { id: "q", title: "Quiz", kind: "light", taCount: 1, createdAt: "", schedule: { type: "one-time", date: "2026-10-20" },
      occurrences: [
        { id: "q1", date: "2026-10-20", seats: [{ taId: "A", turn: 1 }] },
        { id: "q2", date: "2026-10-21", seats: [{ taId: "B", turn: 1 }] },
        { id: "q3", date: "2026-10-23", seats: [{ taId: "B", turn: 1 }, { taId: "C", turn: 1 }] },
        { id: "q4", date: "2026-10-24", seats: [{ taId: "A", turn: 1 }, { taId: "C", turn: 1 }] },
      ] },
    { id: "e", title: "Exam", kind: "heavy", taCount: 1, createdAt: "", schedule: { type: "one-time", date: "2026-10-22" },
      occurrences: [{ id: "e1", date: "2026-10-22", seats: [{ taId: "B", turn: 1 }] }] },
  ],
};

// Steps swap inside AnimatePresence mode="wait"; render them without exit animations.
vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("~/lib/use-workspace", () => ({
  useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map(ws.tas.map((t) => [t.id, t])) }),
}));

test("SwapSheet lists only same-kind targets", async () => {
  const Stub = createRoutesStub([{ path: "/", Component: () => <SwapSheet open onClose={() => {}} ta={A} /> }]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Tue, Oct 20/ }));
  expect(await screen.findByRole("button", { name: /Quiz,\s*Wed, Oct 21/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Exam/ })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Quiz" })).toHaveTextContent(/Light/);
});

test("SwapSheet never offers the TA's own dates as targets and submits two different TAs' dates", async () => {
  const action = vi.fn(async ({ request }: { request: Request }) => {
    body = await request.json();
    return { ok: true, version: 2, snapshotId: 1, label: "Swapped" };
  });
  let body: { command?: unknown } = {};
  const onClose = vi.fn();
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CommandToasts><SwapSheet open onClose={onClose} ta={A} /></CommandToasts> },
    { path: "/api/command", action },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Tue, Oct 20/ }));
  // Step 2 lists only the other TA's same-kind date, never A's own Oct 20.
  expect(screen.queryByRole("button", { name: /Quiz,\s*Tue, Oct 20/ })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Wed, Oct 21/ }));
  await waitFor(() => expect(action).toHaveBeenCalled());
  expect(body.command).toEqual({ type: "swapOccurrences", a: { taskId: "q", occurrenceId: "q1", taId: "A" }, b: { taskId: "q", occurrenceId: "q2", taId: "B" } });
  expect(onClose).toHaveBeenCalled();
});

function renderSheet(onClose = () => {}) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <SwapSheet open onClose={onClose} ta={A} /> }]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
    </ToastProvider>,
  );
}

test("step 1 lists the dates the TA sits on", async () => {
  renderSheet();
  expect(await screen.findAllByRole("button", { name: /Quiz,\s*(Tue, Oct 20|Sat, Oct 24)/ })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /Oct 21|Oct 23/ })).not.toBeInTheDocument();
});

test("step 2 lists one row per swappable seat with its owner", async () => {
  renderSheet();
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Tue, Oct 20/ }));
  expect(await screen.findByRole("button", { name: /Oct 21.*Bassem/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Oct 23.*Bassem/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Oct 23.*Carla/ })).toBeInTheDocument();
});

test("a seat whose TA already sits on the picked date is not listed", async () => {
  renderSheet();
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Sat, Oct 24/ }));
  expect(await screen.findByRole("button", { name: /Oct 23.*Bassem/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Oct 23.*Carla/ })).not.toBeInTheDocument();
});

test("picking a seat submits swapOccurrences with both seats", async () => {
  let body: { command?: unknown } = {};
  const action = vi.fn(async ({ request }: { request: Request }) => {
    body = await request.json();
    return { ok: true, version: 2, snapshotId: 1, label: "Swapped" };
  });
  const Stub = createRoutesStub([
    { path: "/", Component: () => <CommandToasts><SwapSheet open onClose={() => {}} ta={A} /></CommandToasts> },
    { path: "/api/command", action },
  ]);
  render(<ToastProvider><Stub initialEntries={["/"]} /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Tue, Oct 20/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Oct 23.*Carla/ }));
  await waitFor(() => expect(action).toHaveBeenCalled());
  expect(body.command).toEqual({
    type: "swapOccurrences",
    a: { taskId: "q", occurrenceId: "q1", taId: "A" },
    b: { taskId: "q", occurrenceId: "q3", taId: "C" },
  });
});
