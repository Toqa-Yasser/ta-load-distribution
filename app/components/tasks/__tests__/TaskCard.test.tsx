// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TaskCard } from "~/components/tasks/TaskCard";
import { emptyWorkspace } from "~/engine/empty";
import type { Task } from "~/engine/types";

vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: emptyWorkspace() }) }));

const task: Task = { id: "t", title: "Quiz", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [] };

test("Redistribute asks for confirmation before dealing the task out again", () => {
  const onRedistribute = vi.fn();
  render(
    <MemoryRouter>
      <TaskCard task={task} onRedistribute={onRedistribute} onDelete={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions for Quiz" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Redistribute" }));
  expect(onRedistribute).not.toHaveBeenCalled();
  expect(screen.getByText("Deal this task out again? Its current assignments will change.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Redistribute" }));
  expect(onRedistribute).toHaveBeenCalledTimes(1);
});
