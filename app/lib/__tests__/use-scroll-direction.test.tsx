// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { holdSheetOpen } from "~/lib/sheet-open";
import { useScrollDirection } from "~/lib/use-scroll-direction";

function Probe() {
  return <p data-testid="dir">{useScrollDirection()}</p>;
}

const frames: FrameRequestCallback[] = [];
const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)));

/** Scrolls to `y` and runs the frame the listener scheduled. */
const scrollTo = (y: number) => {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
  flush();
};

const setScrollHeight = (h: number) => Object.defineProperty(document.documentElement, "scrollHeight", { value: h, configurable: true });
const dir = () => screen.getByTestId("dir").textContent;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  setScrollHeight(5000);
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});
afterEach(() => {
  frames.length = 0;
  vi.unstubAllGlobals();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  setScrollHeight(0);
});

test("down after scrolling down, up after scrolling up", () => {
  render(<Probe />);
  expect(dir()).toBe("up");
  scrollTo(300);
  expect(dir()).toBe("down");
  scrollTo(250);
  expect(dir()).toBe("up");
  scrollTo(400);
  expect(dir()).toBe("down");
});

test("moves under the threshold are ignored", () => {
  render(<Probe />);
  scrollTo(300);
  expect(dir()).toBe("down");
  scrollTo(295); // 5px up: under the 8px threshold
  expect(dir()).toBe("down");
  scrollTo(290); // 10px up from the last accepted position
  expect(dir()).toBe("up");
});

test("always up near the top (topReveal)", () => {
  render(<Probe />);
  scrollTo(20); // a 20px move down, but still within the top 24px
  expect(dir()).toBe("up");
  scrollTo(300);
  scrollTo(10);
  expect(dir()).toBe("up");
});

test("always up when the document does not scroll", () => {
  setScrollHeight(100);
  render(<Probe />);
  scrollTo(300);
  expect(dir()).toBe("up");
});

test("scroll events are throttled to one read per frame", () => {
  render(<Probe />);
  act(() => {
    for (const y of [100, 200, 300]) {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    }
  });
  expect(frames).toHaveLength(1);
  expect(dir()).toBe("up");
  flush();
  expect(dir()).toBe("down");
});

test("up while a sheet is open, and still up once it closes", () => {
  render(<Probe />);
  scrollTo(300);
  expect(dir()).toBe("down");
  let release!: () => void;
  act(() => {
    release = holdSheetOpen();
  });
  expect(dir()).toBe("up");
  act(() => release());
  expect(dir()).toBe("up");
});

test("up on the server", () => {
  Object.defineProperty(window, "scrollY", { value: 400, configurable: true });
  expect(renderToString(<Probe />)).toContain("up");
});
