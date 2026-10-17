// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createRoutesStub } from "react-router";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";
import { ToastProvider } from "~/lib/toast";
import Calendar from "~/routes/calendar";

// Real AnimatePresence here: the point is that the sheet animates out rather than vanishing.
const A = { id: "A", name: "Ahmed", color: "#f00" };
let ws: Workspace = {
  ...emptyWorkspace(),
  tas: [A],
  tasks: [{ id: "q", title: "Quiz", kind: "light", createdAt: "", schedule: { type: "one-time", date: "2026-10-05" }, taCount: 1,
    occurrences: [{ id: "q1", date: "2026-10-05", seats: [{ taId: "A", turn: 1 }] }] }],
};
vi.mock("~/lib/use-workspace", () => ({
  useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map(ws.tas.map((t) => [t.id, t])) }),
}));

function Page() {
  const [, setTick] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setTick((n) => n + 1)}>refresh</button>
      <Calendar />
    </>
  );
}

test("when its occurrence disappears the popover closes with its last content instead of vanishing", async () => {
  const Stub = createRoutesStub([{ path: "/calendar", Component: Page }]);
  render(<ToastProvider><Stub initialEntries={["/calendar?m=2026-10"]} /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /^Quiz · Oct 5/ }));
  expect(await screen.findByRole("dialog", { name: /^Quiz · / })).toBeInTheDocument();

  ws = { ...ws, tasks: [] }; // deleted elsewhere, or undone
  fireEvent.click(screen.getByRole("button", { name: "refresh", hidden: true }));
  // Still on screen (exiting) and still titled for the occurrence it was opened for…
  expect(screen.getByRole("dialog", { name: /^Quiz · / })).toBeInTheDocument();
  // …then gone once the exit finishes.
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
