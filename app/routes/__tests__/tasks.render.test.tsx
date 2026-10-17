// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { ToastProvider } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";
import type { Task, Workspace } from "~/engine/types";
import Tasks from "~/routes/tasks";

const task = (id: string, title: string, kind: Task["kind"]): Task => ({
  id, title, kind, createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [],
});
const ws: Workspace = { ...emptyWorkspace(), tasks: [task("a", "Quiz", "light"), task("b", "Exam", "heavy"), task("c", "Lab", "light")] };

vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map() }) }));

function renderAt(url: string) {
  const Stub = createRoutesStub([{ path: "/tasks", Component: Tasks as never }]);
  render(
    <ToastProvider>
      <Stub initialEntries={[url]} />
    </ToastProvider>,
  );
}

test("tasks page filters by ?kind", async () => {
  renderAt("/tasks?kind=heavy");
  expect(await screen.findByText("Exam")).toBeInTheDocument();
  expect(screen.queryByText("Quiz")).not.toBeInTheDocument();
  expect(screen.queryByText("Lab")).not.toBeInTheDocument();
  const chips = screen.getByRole("group", { name: "Filter by kind" });
  expect(within(chips).getByRole("button", { name: "Heavy" })).toHaveAttribute("aria-pressed", "true");
  expect(within(chips).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("2 light · 1 heavy")).toBeInTheDocument();
});

test("tasks page shows every task and a kind badge without a filter", async () => {
  renderAt("/tasks");
  expect(await screen.findByText("Quiz")).toBeInTheDocument();
  expect(screen.getByText("Exam")).toBeInTheDocument();
  expect(screen.getByText("Lab")).toBeInTheDocument();
  expect(screen.getAllByText("Light", { selector: "[data-badge]" })).toHaveLength(2);
  expect(screen.getAllByText("Heavy", { selector: "[data-badge]" })).toHaveLength(1);
});

test("an unknown ?kind falls back to every task with All active", async () => {
  renderAt("/tasks?kind=garbage");
  expect(await screen.findByText("Quiz")).toBeInTheDocument();
  expect(screen.getByText("Exam")).toBeInTheDocument();
  expect(screen.getByText("Lab")).toBeInTheDocument();
  const chips = screen.getByRole("group", { name: "Filter by kind" });
  expect(within(chips).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
});

test("a kind with no tasks shows an empty state that clears the filter", async () => {
  const saved = ws.tasks;
  ws.tasks = saved.filter((t) => t.kind === "light");
  try {
    renderAt("/tasks?kind=heavy");
    expect(await screen.findByRole("heading", { name: "No heavy tasks yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all tasks" }));
    expect(await screen.findByText("Quiz")).toBeInTheDocument();
  } finally {
    ws.tasks = saved;
  }
});

test("only the cards of the first render get the CSS entrance; cards that mount later rely on their own motion", async () => {
  renderAt("/tasks?kind=heavy");
  const item = (title: string) => screen.getByText(title).closest("li")!;
  expect(await screen.findByText("Exam")).toBeInTheDocument();
  expect(item("Exam")).toHaveClass("enter-rise");
  fireEvent.click(within(screen.getByRole("group", { name: "Filter by kind" })).getByRole("button", { name: "All" }));
  expect(await screen.findByText("Quiz")).toBeInTheDocument();
  expect(item("Quiz")).not.toHaveClass("enter-rise");
  expect(item("Lab")).not.toHaveClass("enter-rise");
  expect(item("Exam")).toHaveClass("enter-rise");
});
