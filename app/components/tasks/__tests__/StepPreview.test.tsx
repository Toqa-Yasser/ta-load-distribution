// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { StepPreview } from "~/components/tasks/StepPreview";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";

test("preview lists every occurrence with its TA", () => {
  const ws: Workspace = { ...emptyWorkspace(), tas: [{ id: "A", name: "Ahmed", color: "#f00" }],
    tasks: [{ id: "t", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [{ id: "o", date: "2026-10-20", taId: "A", turn: 1 }] }] };
  render(<StepPreview preview={ws} taskTitle="Quiz" loading={false} error={null} />);
  expect(screen.getByText("1 occurrence")).toBeInTheDocument();
  expect(screen.getByText("Oct 20")).toBeInTheDocument();
  expect(screen.getByText("Ahmed")).toBeInTheDocument();
});

test("StepPreview shows gauges for the previewed kind", () => {
  const base = emptyWorkspace();
  const ws: Workspace = {
    ...base,
    tas: [{ id: "A", name: "Ahmed", color: "#f00" }],
    sections: [{ id: "s", name: "S1", taIds: ["A", null] }, { id: "s2", name: "S2", taIds: ["A", null] }],
    ledgers: { light: { turn: 1, used: { A: 0 } }, heavy: { turn: 1, used: { A: 1 } } },
    tasks: [{ id: "t", title: "Exam", kind: "heavy", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [{ id: "o", date: "2026-10-20", taId: "A", turn: 1 }] }],
  };
  const { rerender } = render(<StepPreview preview={ws} taskTitle="Exam" loading={false} error={null} />);
  expect(screen.getByRole("heading", { name: "After this heavy task" })).toBeInTheDocument();
  expect(screen.getByLabelText("Ahmed · 1/2: 50% used")).toBeInTheDocument();

  const light: Workspace = { ...ws, tasks: [{ ...ws.tasks[0], kind: "light" }] };
  rerender(<StepPreview preview={light} taskTitle="Exam" loading={false} error={null} />);
  expect(screen.getByRole("heading", { name: "After this light task" })).toBeInTheDocument();
  expect(screen.getByLabelText("Ahmed · 0/2: 0% used")).toBeInTheDocument();
});
