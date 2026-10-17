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
  render(<StepName kind="light" title="Quiz" notes="" taCount={1} maxTaCount={1} onChange={onChange} onSubmit={() => {}} />);
  fireEvent.click(screen.getByRole("radio", { name: "Heavy" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "heavy", title: "Quiz", notes: "", taCount: 1 });
});

const HINT_MANY = "Each date is covered by this many TAs together. Every one of them counts it toward their load.";
const HINT_FEW = "Give more TAs sections to co-staff dates.";

test("StepName shows a TAs per date stepper capped at the eligible count with the hint", () => {
  const onChange = vi.fn();
  render(<StepName kind="light" title="Quiz" notes="" taCount={1} maxTaCount={3} onChange={onChange} onSubmit={() => {}} />);
  const spin = screen.getByRole("spinbutton", { name: "TAs per date" });
  expect(spin).toHaveAttribute("aria-valuemax", "3");
  expect(screen.getByRole("group", { name: "TAs per date" })).toHaveAccessibleDescription(HINT_MANY);
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "light", title: "Quiz", notes: "", taCount: 2 });
});

test.each([1, 0])("with %i eligible TAs the stepper is capped at 1 and shows the other hint", (n) => {
  render(<StepName kind="light" title="" notes="" taCount={1} maxTaCount={Math.max(1, n)} onChange={() => {}} onSubmit={() => {}} />);
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuemax", "1");
  expect(screen.getByText(HINT_FEW)).toBeInTheDocument();
  expect(screen.queryByText(HINT_MANY)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
});
