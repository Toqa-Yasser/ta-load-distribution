// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createRoutesStub, data } from "react-router";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";
import { ToastProvider } from "~/lib/toast";
import TaskDetail, { ErrorBoundary, loader, meta } from "~/routes/task-detail";

const ws: Workspace = {
  ...emptyWorkspace(),
  tas: [{ id: "A", name: "Ahmed", color: "#f00" }, { id: "B", name: "Bassem", color: "#0f0" }],
  tasks: [{ id: "t", title: "Quiz", kind: "heavy", createdAt: "", schedule: { type: "one-time", date: "2026-10-20" },
    occurrences: [{ id: "o", date: "2026-10-20", taId: "A", turn: 1 }] }],
};
vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map(ws.tas.map((t) => [t.id, t])) }) }));

test("the loader responds 404 for a task that does not exist", async () => {
  const thrown = await Promise.resolve(loader({ params: { taskId: "missing" } } as never)).catch((e) => e);
  // data(…, { status: 404 }), which the router turns into a 404 route error response.
  expect(thrown).toMatchObject({ type: "DataWithResponseInit", data: "Not found", init: { status: 404 } });
});

test("the ErrorBoundary shows the friendly not-found message", async () => {
  const Stub = createRoutesStub([
    {
      path: "/tasks/:taskId",
      Component: TaskDetail as never,
      ErrorBoundary: ErrorBoundary as never,
      loader: () => {
        throw data("Not found", { status: 404 });
      },
    },
  ]);
  render(<Stub initialEntries={["/tasks/missing"]} />);
  expect(await screen.findByRole("heading", { name: "Task not found" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/tasks");
});

test("meta encodes the task id in the canonical path", () => {
  const matches = [{ id: "root", pathname: "/", params: {}, meta: [], loaderData: { appUrl: "https://x.edu", workspace: ws } }];
  const tags = meta({ matches, params: { taskId: "a b/c" }, location: { pathname: "/" }, loaderData: undefined } as never);
  expect(tags).toContainEqual({ tagName: "link", rel: "canonical", href: "https://x.edu/tasks/a%20b%2Fc" });
});

test("the detail page shows the kind badge", async () => {
  const Stub = createRoutesStub([{ path: "/tasks/:taskId", Component: TaskDetail as never }]);
  render(<ToastProvider><Stub initialEntries={["/tasks/t"]} /></ToastProvider>);
  expect(await screen.findByText("Heavy", { selector: "[data-badge]" })).toBeInTheDocument();
});

test("each occurrence shows its TA as text, with nothing to reassign", async () => {
  const Stub = createRoutesStub([{ path: "/tasks/:taskId", Component: TaskDetail as never }]);
  render(<ToastProvider><Stub initialEntries={["/tasks/t"]} /></ToastProvider>);
  const row = (await screen.findByRole("cell", { name: "Ahmed" })).closest("tr")!;
  expect(row).toHaveTextContent("Ahmed");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
