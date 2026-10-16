// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "~/components/ui/Toast";

// Exit animations would keep a dismissed toast mounted; these tests are about the timer only.
vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

function Pusher() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast({ message: "Saved", action: { label: "Undo", onClick: () => {} } })}>
      push
    </button>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  render(<ToastProvider><Pusher /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "push" }));
  return screen.getByRole("status");
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

test("auto-dismisses after 6s", () => {
  const toast = setup();
  advance(5900);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  advance(200);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
test("hover pauses the timer and leaving resumes the remaining time", () => {
  const toast = setup();
  advance(2000);
  fireEvent.mouseEnter(toast);
  advance(10_000);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  fireEvent.mouseLeave(toast);
  advance(3900);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  advance(200);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
test("focus inside pauses until focus leaves, even if the pointer left first", () => {
  const toast = setup();
  fireEvent.mouseEnter(toast);
  fireEvent.focus(screen.getByRole("button", { name: "Undo" }));
  fireEvent.mouseLeave(toast);
  advance(10_000);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  fireEvent.blur(screen.getByRole("button", { name: "Undo" }));
  advance(6100);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
