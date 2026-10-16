// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { StepPreview } from "~/components/tasks/StepPreview";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";

test("preview lists every occurrence with its TA", () => {
  const ws: Workspace = { ...emptyWorkspace(), tas: [{ id: "A", name: "Ahmed", color: "#f00" }],
    tasks: [{ id: "t", title: "Quiz", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" }, occurrences: [{ id: "o", date: "2026-10-20", taId: "A", turn: 1 }] }] };
  render(<StepPreview preview={ws} taskTitle="Quiz" loading={false} error={null} />);
  expect(screen.getByText("1 occurrence")).toBeInTheDocument();
  expect(screen.getByText("Oct 20")).toBeInTheDocument();
  expect(screen.getByText("Ahmed")).toBeInTheDocument();
});
