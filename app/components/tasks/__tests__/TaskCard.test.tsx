// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TaskCard } from "~/components/tasks/TaskCard";
import { emptyWorkspace } from "~/engine/empty";
import type { Task } from "~/engine/types";

vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: emptyWorkspace() }) }));

const task: Task = { id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [] };

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

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

test("kebab menu: focus moves to the first item, arrows/Home/End move, Escape closes and refocuses the trigger", async () => {
  render(
    <MemoryRouter>
      <TaskCard task={task} onRedistribute={() => {}} onDelete={() => {}} />
    </MemoryRouter>,
  );
  const trigger = screen.getByRole("button", { name: "Actions for Quiz" });
  trigger.focus();
  fireEvent.click(trigger);
  const [redistribute, del] = screen.getAllByRole("menuitem");
  await waitFor(() => expect(document.activeElement).toBe(redistribute));
  const menu = screen.getByRole("menu");
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  expect(document.activeElement).toBe(del);
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  expect(document.activeElement).toBe(redistribute);
  fireEvent.keyDown(menu, { key: "ArrowUp" });
  expect(document.activeElement).toBe(del);
  fireEvent.keyDown(menu, { key: "Home" });
  expect(document.activeElement).toBe(redistribute);
  fireEvent.keyDown(menu, { key: "End" });
  expect(document.activeElement).toBe(del);
  expect(redistribute).toHaveAttribute("tabindex", "-1");
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("ArrowDown on the trigger opens the menu", async () => {
  render(
    <MemoryRouter>
      <TaskCard task={task} onRedistribute={() => {}} onDelete={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Quiz" }), { key: "ArrowDown" });
  await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[0]));
});
