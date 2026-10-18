// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { NewTaskSheet } from "~/components/tasks/NewTaskSheet";
import { reconcileOrder, StepName } from "~/components/tasks/StepName";
import { ToastProvider } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";
import type { TA } from "~/engine/types";

vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: emptyWorkspace(), today: "2026-10-17" }) }));

test("StepName offers Light/Heavy/Equal and defaults to light", () => {
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
  expect(screen.getByRole("radio", { name: "Equal" })).toHaveAttribute("aria-checked", "false");
  expect(
    screen.getByText("Light and heavy tasks are shared out independently — each has its own fairness counter."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Heavy" }));
  expect(screen.getByRole("radio", { name: "Heavy" })).toHaveAttribute("aria-checked", "true");
});

test("StepName reports kind changes", () => {
  const onChange = vi.fn();
  render(<StepName kind="light" title="Quiz" notes="" taCount={1} taOrder={[]} tas={[]} maxTaCount={1} onChange={onChange} onSubmit={() => {}} />);
  fireEvent.click(screen.getByRole("radio", { name: "Heavy" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "heavy", title: "Quiz", notes: "", taCount: 1, taOrder: [] });
});

const HINT_MANY = "Each date is covered by this many TAs together. Every one of them counts it toward their load.";
const HINT_FEW = "Give more TAs sections to co-staff dates.";

test("StepName shows a TAs per date stepper capped at the eligible count with the hint", () => {
  const onChange = vi.fn();
  render(<StepName kind="light" title="Quiz" notes="" taCount={1} taOrder={[]} tas={[]} maxTaCount={3} onChange={onChange} onSubmit={() => {}} />);
  const spin = screen.getByRole("spinbutton", { name: "TAs per date" });
  expect(spin).toHaveAttribute("aria-valuemax", "3");
  expect(screen.getByRole("group", { name: "TAs per date" })).toHaveAccessibleDescription(HINT_MANY);
  expect(spin).toHaveAccessibleDescription(HINT_MANY);
  expect(screen.getByText("TAs per date")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "light", title: "Quiz", notes: "", taCount: 2, taOrder: [] });
});

test.each([1, 0])("with %i eligible TAs the stepper is capped at 1 and shows the other hint", (n) => {
  render(<StepName kind="light" title="" notes="" taCount={1} taOrder={[]} tas={[]} maxTaCount={Math.max(1, n)} onChange={() => {}} onSubmit={() => {}} />);
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAttribute("aria-valuemax", "1");
  expect(screen.getByText(HINT_FEW)).toBeInTheDocument();
  expect(screen.queryByText(HINT_MANY)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
});

const A: TA = { id: "A", name: "Ahmed", color: "#f00" };
const B: TA = { id: "B", name: "Bassem", color: "#0f0" };
const C: TA = { id: "C", name: "Carla", color: "#00f" };
const HINT_EQUAL_KIND = "Equal tasks go round the TAs in the order below, one date each, whatever their sections.";
const HINT_EQUAL_MANY = "Each date is covered by this many TAs together, taken in turn from the order.";
const HINT_EQUAL_FEW = "Add more TAs to co-staff dates.";

test("choosing Equal shows the equal hint and the order list", () => {
  const onChange = vi.fn();
  const props = { title: "Quiz", notes: "", taCount: 1, taOrder: ["A", "B"], tas: [A, B], maxTaCount: 2, onChange, onSubmit: () => {} };
  const { rerender } = render(<StepName kind="light" {...props} />);
  expect(screen.queryByRole("list", { name: "Order" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Equal" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "equal", title: "Quiz", notes: "", taCount: 1, taOrder: ["A", "B"] });
  rerender(<StepName kind="equal" {...props} />);
  expect(screen.getByRole("radiogroup", { name: "Kind" })).toHaveAccessibleDescription(HINT_EQUAL_KIND);
  expect(screen.queryByText("Light and heavy tasks are shared out independently — each has its own fairness counter.")).not.toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Order" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Move Ahmed down" }));
  expect(onChange).toHaveBeenLastCalledWith({ kind: "equal", title: "Quiz", notes: "", taCount: 1, taOrder: ["B", "A"] });
});

test("the equal stepper hint", () => {
  const props = { kind: "equal" as const, title: "", notes: "", taCount: 1, taOrder: ["A", "B", "C"], tas: [A, B, C], onChange: () => {}, onSubmit: () => {} };
  const { rerender } = render(<StepName {...props} maxTaCount={3} />);
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAccessibleDescription(HINT_EQUAL_MANY);
  expect(screen.queryByText(HINT_MANY)).not.toBeInTheDocument();
  rerender(<StepName {...props} maxTaCount={1} />);
  expect(screen.getByRole("spinbutton", { name: "TAs per date" })).toHaveAccessibleDescription(HINT_EQUAL_FEW);
  expect(screen.queryByText(HINT_FEW)).not.toBeInTheDocument();
});

test("reconcileOrder drops unknown ids and appends new TAs", () => {
  expect(reconcileOrder(["B", "X"], [A, B, C])).toEqual(["B", "A", "C"]);
});
