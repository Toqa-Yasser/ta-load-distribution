// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRoutesStub, MemoryRouter } from "react-router";
import { OccurrencePopover } from "~/components/calendar/OccurrencePopover";
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
    { id: "q", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-05" }, taCount: 1, occurrences: [
      { id: "q1", date: "2026-10-05", seats: [{ taId: "A", turn: 1 }] }, { id: "q2", date: "2026-10-06", seats: [{ taId: "A", turn: 1 }] },
      { id: "q3", date: "2026-10-07", seats: [{ taId: "B", turn: 1 }] }] },
    { id: "e", title: "Exam", kind: "heavy", createdAt: "", schedule: { type: "one-time", date: "2026-10-08" }, taCount: 1, occurrences: [
      { id: "e1", date: "2026-10-08", seats: [{ taId: "B", turn: 1 }] }] },
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

const C = { id: "C", name: "Carla", color: "#00f" };
// A co-staffed light task: Oct 10 is Bassem + Carla, Oct 11 is Ahmed + Carla.
const withLab = (): Workspace => {
  const ws = base();
  return {
    ...ws,
    tas: [A, B, C],
    tasks: [...ws.tasks, { id: "l", title: "Lab", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-10" }, taCount: 2,
      occurrences: [
        { id: "l1", date: "2026-10-10", seats: [{ taId: "B", turn: 1 }, { taId: "C", turn: 1 }] },
        { id: "l2", date: "2026-10-11", seats: [{ taId: "A", turn: 1 }, { taId: "C", turn: 1 }] },
      ] }],
  };
};

const commands: unknown[] = [];
const action = vi.fn(async ({ request }: { request: Request }) => {
  commands.push(((await request.json()) as { command: unknown }).command);
  return { ok: true, version: 2, snapshotId: 1, label: "Done" };
});
beforeEach(() => {
  ws = base();
  action.mockClear();
  commands.length = 0;
});

function renderAt(url: string) {
  const Stub = createRoutesStub([
    { path: "/calendar", Component: () => <CommandToasts><Calendar /></CommandToasts> },
    { path: "/api/command", action },
  ]);
  return render(<ToastProvider><Stub initialEntries={[url]} /></ToastProvider>);
}
const pill = (name: RegExp) => screen.getByRole("button", { name });
// A single-seat occurrence offers "Swap with…"; a co-staffed one offers "Swap <name>" per seat.
const startSwapFrom = async (name: RegExp, taName?: string) => {
  fireEvent.click(await screen.findByRole("button", { name }));
  fireEvent.click(await screen.findByRole("button", { name: taName ? `Swap ${taName}` : "Swap with…" }));
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

test("the popover names the assigned TA but offers no way to reassign", async () => {
  renderAt("/calendar?m=2026-10");
  fireEvent.click(await screen.findByRole("button", { name: /^Quiz · Oct 5/ }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Assigned TA");
  expect(dialog).toHaveTextContent("Ahmed");
  expect(screen.queryByRole("combobox", { name: "Assigned TA" })).not.toBeInTheDocument();
  expect(dialog).not.toHaveTextContent("Assigned TAs");
  expect(screen.getByRole("button", { name: "Swap with…" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Swap Ahmed" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("listitem")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("link", { name: "Open task" })).toBeInTheDocument();
});

test("Swap with… on a single-seat popover starts swap mode from its TA", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  expect(await screen.findByRole("status")).toHaveTextContent("Pick another light occurrence to swap with");
  expect(pill(/^Quiz · Oct 5 · Ahmed · Light · swapping/)).toBeInTheDocument();
});

test("popover lists every seat with its own Swap button", async () => {
  ws = withLab();
  renderAt("/calendar?m=2026-10");
  fireEvent.click(await screen.findByRole("button", { name: "Lab · Oct 10 · Bassem, Carla · Light" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Assigned TAs")).toBeInTheDocument();
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  expect(within(dialog).getAllByRole("button", { name: /^Swap / }).map((b) => b.getAttribute("aria-label") ?? b.textContent))
    .toEqual(["Swap Bassem", "Swap Carla"]);
  expect(within(dialog).getByRole("link", { name: "Open task" })).toBeInTheDocument();
});

test("popover in pick mode lists only pickable seats and no Open task link", () => {
  const lab = withLab().tasks[2];
  const onPickSeat = vi.fn();
  render(
    <MemoryRouter>
      <OccurrencePopover open task={lab} occ={lab.occurrences[0]} tas={[A, B, C]} mode="pick" pickable={["C"]}
        sourceName="Ahmed" onStartSwap={() => {}} onPickSeat={onPickSeat} onClose={() => {}} />
    </MemoryRouter>,
  );
  const dialog = screen.getByRole("dialog", { name: /^Lab · / });
  expect(dialog).toHaveTextContent("Swap Ahmed's seat with");
  expect(within(dialog).getAllByRole("button", { name: /^Swap / }).map((b) => b.getAttribute("aria-label") ?? b.textContent))
    .toEqual(["Swap Carla"]);
  expect(within(dialog).queryByRole("link", { name: "Open task" })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Swap Carla" }));
  expect(onPickSeat).toHaveBeenCalledWith("C");
});

test("calendar swap: tapping a valid 1-seat pill submits swapOccurrences with both taIds", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  fireEvent.click(pill(/^Quiz · Oct 7 · Bassem/));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(commands[0]).toEqual({
    type: "swapOccurrences",
    a: { taskId: "q", occurrenceId: "q1", taId: "A" },
    b: { taskId: "q", occurrenceId: "q3", taId: "B" },
  });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("a multi-seat pill with a single valid seat swaps at once", async () => {
  ws = withLab();
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Lab · Oct 11/, "Ahmed");
  // Oct 10 holds Bassem and Carla; Carla already sits on Oct 11, so only Bassem's seat can trade.
  fireEvent.click(pill(/^Lab · Oct 10/));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(commands[0]).toEqual({
    type: "swapOccurrences",
    a: { taskId: "l", occurrenceId: "l2", taId: "A" },
    b: { taskId: "l", occurrenceId: "l1", taId: "B" },
  });
});

test("tapping a multi-seat pill opens the seat chooser and picking submits", async () => {
  ws = withLab();
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  // Ahmed already sits on Lab Oct 11, so that pill is dimmed; Oct 10 has two seats to choose from.
  expect(pill(/^Lab · Oct 11/).className).toContain("opacity-40");
  fireEvent.click(pill(/^Lab · Oct 10 · Bassem, Carla/));
  const dialog = await screen.findByRole("dialog", { name: /^Lab · / });
  expect(dialog).toHaveTextContent("Swap Ahmed's seat with");
  expect(within(dialog).queryByRole("link", { name: "Open task" })).not.toBeInTheDocument();
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Swap Carla" }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(commands[0]).toEqual({
    type: "swapOccurrences",
    a: { taskId: "q", occurrenceId: "q1", taId: "A" },
    b: { taskId: "l", occurrenceId: "l1", taId: "C" },
  });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("swapping from a co-staffed date names the moving seat in the status bar", async () => {
  ws = withLab();
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Lab · Oct 10/, "Bassem");
  expect(await screen.findByRole("status")).toHaveTextContent("Swapping Bassem's seat — pick another light occurrence");
});

test("swapping from a single-seat date keeps the plain status text", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Exam · Oct 8/);
  expect(await screen.findByRole("status")).toHaveTextContent("Pick another heavy occurrence to swap with");
  expect(screen.getByRole("status")).not.toHaveTextContent("seat");
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

test("swap mode ends when the source TA leaves the source occurrence", async () => {
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  expect(screen.getByRole("status")).toBeInTheDocument();
  // The occurrence survives (e.g. an undo of a reassign) but Ahmed no longer sits on it.
  setWs({ ...ws, tasks: ws.tasks.map((t) => (t.id === "q" ? { ...t, occurrences: t.occurrences.map((o) =>
    o.id === "q1" ? { ...o, seats: [{ taId: "B", turn: 1 }] } : o) } : t)) });
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /· swapping$/ })).not.toBeInTheDocument();
  expect(pill(/^Exam · Oct 8/).className).not.toContain("opacity-40");
});

test("the seat chooser closes when swap mode ends underneath it", async () => {
  ws = withLab();
  renderAt("/calendar?m=2026-10");
  await startSwapFrom(/^Quiz · Oct 5/);
  fireEvent.click(pill(/^Lab · Oct 10 · Bassem, Carla/));
  expect(await screen.findByRole("dialog", { name: /^Lab · / })).toHaveTextContent("Swap Ahmed's seat with");
  // An undo elsewhere moves Ahmed off the source date while the chooser is open.
  setWs({ ...ws, tasks: ws.tasks.map((t) => (t.id === "q" ? { ...t, occurrences: t.occurrences.map((o) =>
    o.id === "q1" ? { ...o, seats: [{ taId: "B", turn: 1 }] } : o) } : t)) });
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Lab · / })).not.toBeInTheDocument());
  await act(() => new Promise((r) => setTimeout(r, 30)));
  expect(action).not.toHaveBeenCalled();
});
