// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TaskCard } from "~/components/tasks/TaskCard";
import { emptyWorkspace } from "~/engine/empty";
import type { Task } from "~/engine/types";

vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: emptyWorkspace() }) }));

const task: Task = { id: "t", title: "Quiz", kind: "light", createdAt: "", taCount: 1, schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [] };

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

test("ArrowUp on the trigger opens the menu on its last item", async () => {
  render(
    <MemoryRouter>
      <TaskCard task={task} onRedistribute={() => {}} onDelete={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Quiz" }), { key: "ArrowUp" });
  await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("menuitem").at(-1)));
});

describe("pressing the kebab or a menu item does not press the card", () => {
  beforeAll(async () => {
    (await import("motion/react")).MotionGlobalConfig.instantAnimations = true;
  });
  afterAll(async () => {
    (await import("motion/react")).MotionGlobalConfig.instantAnimations = false;
  });
  const press = async (el: HTMLElement) => {
    fireEvent.pointerDown(el, { isPrimary: true, button: 0, pointerType: "mouse" });
    await new Promise((r) => setTimeout(r, 30));
  };
  const cardOf = (el: HTMLElement) => el.closest<HTMLElement>(".card-lift")!;

  test("the card itself still dips; the kebab and its items claim their own press", async () => {
    render(
      <MemoryRouter>
        <TaskCard task={task} onRedistribute={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole("button", { name: "Actions for Quiz" });
    const card = cardOf(trigger);
    await press(trigger);
    expect(card.style.transform).not.toContain("scale");
    fireEvent.pointerUp(window);
    fireEvent.click(trigger);
    await press(screen.getByRole("menuitem", { name: "Delete" }));
    expect(card.style.transform).not.toContain("scale");
    fireEvent.pointerUp(window);
    await press(screen.getByRole("link", { name: "Quiz" }));
    expect(card.style.transform).toContain("scale(0.98)");
  });
});

test("the subtitle uses fmtTaskSummary", () => {
  render(
    <MemoryRouter>
      <TaskCard task={{ ...task, taCount: 2 }} onRedistribute={() => {}} onDelete={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByText("One-time · Oct 20 · 2 TAs per date")).toBeInTheDocument();
});
