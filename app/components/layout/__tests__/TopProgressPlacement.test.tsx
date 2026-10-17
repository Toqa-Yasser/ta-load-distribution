// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const nav = vi.hoisted(() => ({ state: "loading" as string }));

vi.mock("react-router", async (orig) => ({
  ...(await orig<typeof import("react-router")>()),
  useNavigation: () => ({ state: nav.state }),
  useFetchers: () => [],
  Links: () => null,
  Meta: () => null,
  Scripts: () => null,
  ScrollRestoration: () => null,
}));
vi.mock("../Header", () => ({ Header: () => null }));
vi.mock("../NavBar", () => ({ NavBar: () => null }));
vi.mock("../Background", () => ({ Background: () => null }));
vi.mock("../SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("../CommandToasts", () => ({ CommandToasts: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("~/lib/use-history", () => ({ UNDO_FETCHER_KEY: "undo", useHistory: () => {} }));

import App from "~/root";

afterEach(() => vi.useRealTimers());

test("TopProgress stays outside #app-root, so a sheet's inert never silences it", () => {
  vi.useFakeTimers();
  const Stub = createRoutesStub([{ path: "/", Component: App, children: [{ index: true, Component: () => <p>page</p> }] }]);
  render(<Stub initialEntries={["/"]} />);
  act(() => void vi.advanceTimersByTime(130));
  const bar = screen.getByRole("progressbar", { name: "Loading" });
  expect(document.getElementById("app-root")).not.toBeNull();
  expect(bar.closest("#app-root")).toBeNull();
  expect(document.body).toHaveAttribute("aria-busy", "true");
});
