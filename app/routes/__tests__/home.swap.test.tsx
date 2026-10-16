// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createRoutesStub } from "react-router";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";
import { ToastProvider } from "~/lib/toast";
import Home from "~/routes/home";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const A = { id: "A", name: "Ahmed", color: "#f00" };
const withA: Workspace = { ...emptyWorkspace(), tas: [A] };
let ws = withA;
vi.mock("~/lib/use-workspace", () => ({
  useWorkspace: () => ({ workspace: ws, today: "2026-10-17", capacities: {}, taById: new Map(ws.tas.map((t) => [t.id, t])) }),
}));

function Page() {
  const [, tick] = useState(0);
  return (
    <>
      <button type="button" onClick={() => tick((n) => n + 1)}>refresh</button>
      <Home />
    </>
  );
}

test("the swap sheet does not spring back open when its TA disappears and an undo restores it", async () => {
  const Stub = createRoutesStub([{ path: "/", Component: Page }]);
  render(<ToastProvider><Stub initialEntries={["/"]} /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Swap one of Ahmed's dates" }));
  expect(screen.getByRole("dialog", { name: "Swap a date · Ahmed" })).toBeInTheDocument();

  ws = { ...withA, tas: [] }; // removed elsewhere
  fireEvent.click(screen.getByRole("button", { name: "refresh", hidden: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  ws = withA; // Undo brings the TA back
  fireEvent.click(screen.getByRole("button", { name: "refresh", hidden: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
