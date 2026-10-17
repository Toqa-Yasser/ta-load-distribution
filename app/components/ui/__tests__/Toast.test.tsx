// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Toaster, ToastProvider, useToast } from "~/components/ui/Toast";

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
  render(<ToastProvider><Pusher /><Toaster /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "push" }));
  return screen.getByRole("status");
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

test("auto-dismisses after 6s", () => {
  setup();
  advance(5900);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  advance(200);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
test("hover pauses the timer and leaving resumes the remaining time", () => {
  const toast = setup();
  advance(2000);
  fireEvent.pointerEnter(toast, { pointerType: "mouse" });
  advance(10_000);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  fireEvent.pointerLeave(toast, { pointerType: "mouse" });
  advance(3900);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  advance(200);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
test("focus inside pauses until focus leaves, even if the pointer left first", () => {
  const toast = setup();
  fireEvent.pointerEnter(toast, { pointerType: "mouse" });
  fireEvent.focus(screen.getByRole("button", { name: "Undo" }));
  fireEvent.pointerLeave(toast, { pointerType: "mouse" });
  advance(10_000);
  expect(screen.getByText("Saved")).toBeInTheDocument();
  fireEvent.blur(screen.getByRole("button", { name: "Undo" }));
  advance(6100);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
test("a touch over the toast does not pause the timer", () => {
  const toast = setup();
  fireEvent.pointerEnter(toast, { pointerType: "touch" });
  advance(6100);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});
test("timers of toasts dropped from the stack or dismissed are cleared", () => {
  render(<ToastProvider><Pusher /><Toaster /></ToastProvider>);
  const push = screen.getByRole("button", { name: "push" });
  for (let i = 0; i < 4; i++) fireEvent.click(push);
  expect(screen.getAllByText("Saved")).toHaveLength(3);
  expect(vi.getTimerCount()).toBe(3);
  fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
  expect(vi.getTimerCount()).toBe(2);
});

test("a success toast shows a check mark; under reduced motion it is drawn already, not drawn on", () => {
  const toast = setup();
  const check = toast.querySelector("[data-toast-check]");
  expect(check).not.toBeNull();
  const path = check!.querySelector("path")!;
  // Reduced motion (mocked above): no pathLength tween, so no dash offset is left on the stroke.
  expect(path.getAttribute("stroke-dashoffset") ?? "0").toMatch(/^0(px)?$/);
});

test("toast clears the tab bar", () => {
  const container = setup().parentElement!;
  const cls = container.className.split(/\s+/);
  expect(cls).toContain("max-md:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem)]");
  expect(cls).toContain("md:bottom-6");
});
