// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { CommandToasts } from "~/components/layout/CommandToasts";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";
import { ToastProvider } from "~/lib/toast";
import Calendar from "~/routes/calendar";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const A = { id: "A", name: "Ahmed", color: "#f00" };
const B = { id: "B", name: "Bassem", color: "#0f0" };
const base = (): Workspace => ({
  ...emptyWorkspace(),
  tas: [A, B],
  tasks: [
    { id: "q", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-05" }, occurrences: [
      { id: "q1", date: "2026-10-05", taId: "A", turn: 1 }, { id: "q2", date: "2026-10-06", taId: "A", turn: 1 },
      { id: "q3", date: "2026-10-07", taId: "B", turn: 1 }] },
    { id: "e", title: "Exam", kind: "heavy", createdAt: "", schedule: { type: "one-time", date: "2026-10-08" }, occurrences: [
      { id: "e1", date: "2026-10-08", taId: "B", turn: 1 }] },
  ],
});
let ws = base();
const listeners = new Set<() => void>();
const setWs = (next: Workspace) => {
  ws = next;
  act(() => listeners.forEach((l) => l()));
};
vi.mock("~/lib/use-workspace", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
  return {
    useWorkspace: () => {
      const workspace = useSyncExternalStore(subscribe, () => ws);
      return { workspace, today: "2026-10-17", taById: new Map(workspace.tas.map((t) => [t.id, t])) };
    },
  };
});

const action = vi.fn(async () => ({ ok: true, version: 2, snapshotId: 1, label: "Done" }));
beforeEach(() => {
  ws = base();
  action.mockClear();
});

function renderAt(url: string) {
  const Stub = createRoutesStub([
    { path: "/calendar", Component: () => <CommandToasts><Calendar /></CommandToasts> },
    { path: "/api/command", action },
  ]);
  return render(<ToastProvider><Stub initialEntries={[url]} /></ToastProvider>);
}
const pill = (name: RegExp) => screen.getByRole("button", { name });
const startSwapFrom = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole("button", { name }));
  fireEvent.click(await screen.findByRole("button", { name: "Swap with…" }));
};

test("an invalid ?m= falls back to the current month", async () => {
  renderAt("/calendar?m=2026-13");
  expect(await screen.findByText("October 2026")).toBeInTheDocument();
});

test("a valid ?m= shows that month", async () => {
  renderAt("/calendar?m=2026-11");
  expect(await screen.findByText("November 2026")).toBeInTheDocument();
});

test("swap mode dims the source TA's other pills and other-kind pills", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  expect(pill(/^Quiz · Oct 6 · Ahmed/).className).toContain("opacity-40");
  expect(pill(/^Exam · Oct 8/).className).toContain("opacity-40");
  expect(pill(/^Quiz · Oct 7 · Bassem/).className).not.toContain("opacity-40");
});

test("swap mode ignores same-TA and cross-kind targets, then swaps a valid one", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  fireEvent.click(pill(/^Quiz · Oct 6 · Ahmed/));
  fireEvent.click(pill(/^Exam · Oct 8/));
  await act(() => new Promise((r) => setTimeout(r, 30)));
  expect(action).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Pick another light occurrence");
  fireEvent.click(pill(/^Quiz · Oct 7 · Bassem/));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
});

test("re-picking the current TA in the popover sends nothing", async () => {
  renderAt("/calendar?m=2026-10");
  fireEvent.click(await screen.findByRole("button", { name: /^Quiz · Oct 5/ }));
  fireEvent.change(await screen.findByRole("combobox", { name: "Assigned TA" }), { target: { value: "A" } });
  await act(() => new Promise((r) => setTimeout(r, 30)));
  expect(action).not.toHaveBeenCalled();
});

test("pills are plain buttons, not toggle buttons", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  expect(pill(/^Quiz · Oct 5 · Ahmed · Light · swapping/)).not.toHaveAttribute("aria-pressed");
});


test("with no tasks the calendar shows an empty state that leads to a new task", async () => {
  ws = { ...base(), tasks: [] };
  renderAt("/calendar");
  expect(await screen.findByRole("heading", { name: "Nothing scheduled yet" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New task" })).toBeInTheDocument();
  expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
  expect(screen.queryByText("Mon")).not.toBeInTheDocument();
});

test("swap mode ends when the source occurrence disappears", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  expect(screen.getByRole("status")).toBeInTheDocument();
  setWs({ ...ws, tasks: ws.tasks.map((t) => (t.id === "q" ? { ...t, occurrences: t.occurrences.filter((o) => o.id !== "q1") } : t)) });
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(pill(/^Quiz · Oct 6 · Ahmed/).className).not.toContain("opacity-40");
  expect(pill(/^Exam · Oct 8/).className).not.toContain("opacity-40");
});
