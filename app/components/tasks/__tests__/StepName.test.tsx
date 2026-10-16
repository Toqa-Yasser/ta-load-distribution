// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { NewTaskSheet } from "~/components/tasks/NewTaskSheet";
import { StepName } from "~/components/tasks/StepName";
import { ToastProvider } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";

vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: emptyWorkspace(), today: "2026-10-17" }) }));

test("StepName offers Light/Heavy and defaults to light", () => {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <NewTaskSheet open onClose={() => {}} /> },
  ]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
    </ToastProvider>,
  );
  const group = screen.getByRole("radiogroup", { name: "Kind" });
  expect(group).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "Heavy" })).toHaveAttribute("aria-checked", "false");
  expect(
    screen.getByText("Light and heavy tasks are shared out independently — each has its own fairness counter."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Heavy" }));
  expect(screen.getByRole("radio", { name: "Heavy" })).toHaveAttribute("aria-checked", "true");
});

test("StepName reports kind changes", () => {
  const onChange = vi.fn();
  render(<StepName kind="light" title="Quiz" notes="" onChange={onChange} onSubmit={() => {}} />);
  fireEvent.click(screen.getByRole("radio", { name: "Heavy" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "heavy", title: "Quiz", notes: "" });
});
