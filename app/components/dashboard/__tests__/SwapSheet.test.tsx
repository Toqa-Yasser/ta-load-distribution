// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { SwapSheet } from "~/components/dashboard/SwapSheet";
import { ToastProvider } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";
import type { TA, Workspace } from "~/engine/types";

const A: TA = { id: "A", name: "Ahmed", color: "#f00" };
const B: TA = { id: "B", name: "Bassem", color: "#0f0" };
const ws: Workspace = {
  ...emptyWorkspace(),
  tas: [A, B],
  tasks: [
    { id: "q", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" },
      occurrences: [{ id: "q1", date: "2026-10-20", taId: "A", turn: 1 }, { id: "q2", date: "2026-10-21", taId: "B", turn: 1 }] },
    { id: "e", title: "Exam", kind: "heavy", createdAt: "", schedule: { type: "one-time", date: "2026-10-22" },
      occurrences: [{ id: "e1", date: "2026-10-22", taId: "B", turn: 1 }] },
  ],
};

vi.mock("~/lib/use-workspace", () => ({
  useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map(ws.tas.map((t) => [t.id, t])) }),
}));

test("SwapSheet lists only same-kind targets", async () => {
  const Stub = createRoutesStub([{ path: "/", Component: () => <SwapSheet open onClose={() => {}} ta={A} /> }]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/"]} />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Quiz,\s*Tue, Oct 20/ }));
  expect(await screen.findByRole("button", { name: /Quiz,\s*Wed, Oct 21/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Exam/ })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Quiz" })).toHaveTextContent(/Light/);
});
