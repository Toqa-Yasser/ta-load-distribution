// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { capacities } from "~/engine/capacity";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";
import { ToastProvider } from "~/lib/toast";
import Team from "~/routes/team";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const ws: Workspace = {
  ...emptyWorkspace(),
  tas: [{ id: "A", name: "Ahmed", color: "#f00" }, { id: "B", name: "Bassem", color: "#0f0" }],
  sections: [{ id: "s1", name: "S1", taIds: [null, null] }],
};
vi.mock("~/lib/use-workspace", () => ({
  useWorkspace: () => ({ workspace: ws, today: "2026-10-17", capacities: capacities(ws), taById: new Map(ws.tas.map((t) => [t.id, t])) }),
}));

test("a slot shows its new TA (and the TA's capacity) before the server answers", async () => {
  const action = vi.fn(() => new Promise(() => {})); // never settles
  const Stub = createRoutesStub([
    { path: "/team", Component: Team as never },
    { path: "/api/command", action },
  ]);
  render(<ToastProvider><Stub initialEntries={["/team"]} /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Empty slot 1 of S1: Tap or drop a TA" }));
  fireEvent.click(await screen.findByRole("button", { name: "Ahmed" }));
  expect(await screen.findByRole("button", { name: "Slot 1 of S1: Ahmed" })).toBeInTheDocument();
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByTitle("Capacity 1")).toHaveTextContent("1");
  expect(screen.getByText(/1 unit per turn/)).toBeInTheDocument();
});
