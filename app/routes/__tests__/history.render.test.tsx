// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { ToastProvider } from "~/components/ui/Toast";
import History from "~/routes/history";

// AppShell keeps the exiting route mounted during its exit animation, after the router has
// already left the route, so the route's own loader data is undefined for that moment.
test("History renders its empty state when its loader data is gone", async () => {
  const Stub = createRoutesStub([{ path: "/history", Component: History as never }]);
  render(
    <ToastProvider>
      <Stub initialEntries={["/history"]} />
    </ToastProvider>,
  );
  expect(await screen.findByText("No history yet")).toBeInTheDocument();
  expect(screen.getByText("0 snapshots")).toBeInTheDocument();
});
