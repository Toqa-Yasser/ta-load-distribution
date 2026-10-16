// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { UNREADABLE_WORKSPACE_MESSAGE } from "~/lib/errors";
import { MemoryStore } from "~/server/memory-store";
import { ErrorBoundary, loader } from "~/root";

const boundary = (error: unknown) => render(<ErrorBoundary error={error} params={{}} loaderData={undefined} />);

afterEach(() => {
  globalThis.__memStore = undefined;
  vi.unstubAllEnvs();
});

test("the message points outside the app (History and Settings can't load either)", () => {
  expect(UNREADABLE_WORKSPACE_MESSAGE).toBe(
    "The saved workspace couldn't be read, so the app can't load. Ask the administrator to restore the workspace record (for example from a database backup).",
  );
});

test("the root loader turns an unreadable workspace document into a specific 500", async () => {
  const store = new MemoryStore();
  await store.putWorkspace({ nonsense: true } as never, null);
  globalThis.__memStore = store;
  const thrown = await loader().catch((e) => e);
  expect(thrown).toMatchObject({
    type: "DataWithResponseInit",
    data: UNREADABLE_WORKSPACE_MESSAGE,
    init: { status: 500 },
  });
});

test("the error page shows a route error's message", () => {
  vi.stubEnv("DEV", false);
  // What the router hands the boundary for data(message, { status: 500 }).
  boundary({ status: 500, statusText: "", internal: false, data: UNREADABLE_WORKSPACE_MESSAGE });
  expect(screen.getByText(UNREADABLE_WORKSPACE_MESSAGE)).toBeInTheDocument();
});

test("in production other errors stay generic", () => {
  vi.stubEnv("DEV", false);
  boundary(new Error("db password is hunter2"));
  expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
});
