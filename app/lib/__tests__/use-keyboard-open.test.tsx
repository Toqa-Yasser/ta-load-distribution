// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useKeyboardOpen } from "~/lib/use-keyboard-open";

function Probe() {
  return <p data-testid="kb">{useKeyboardOpen() ? "open" : "closed"}</p>;
}
const kb = () => screen.getByTestId("kb").textContent;

type Listener = () => void;
function stubViewport(height: number) {
  const vv = { height, listeners: [] as Listener[], addEventListener: (_: string, l: Listener) => vv.listeners.push(l), removeEventListener() {} };
  vi.stubGlobal("visualViewport", vv);
  return vv;
}
function stubMatchMedia(matching: string[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: matching.includes(q), media: q, addEventListener() {}, removeEventListener() {} }));
}
const frames: FrameRequestCallback[] = [];
const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)));
const setInner = (h: number) => Object.defineProperty(window, "innerHeight", { value: h, configurable: true });

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  setInner(800);
});
afterEach(() => {
  frames.length = 0;
  vi.unstubAllGlobals();
  setInner(768);
});

test("open while the visual viewport is more than 150px shorter than the window (iOS)", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  expect(kb()).toBe("closed");
  act(() => {
    vv.height = 460;
    vv.listeners.forEach((l) => l());
  });
  expect(kb()).toBe("closed"); // throttled to the next frame
  flush();
  expect(kb()).toBe("open");
  act(() => {
    vv.height = 800;
    vv.listeners.forEach((l) => l());
  });
  flush();
  expect(kb()).toBe("closed");
});

test("a small change (URL bar) is not the keyboard", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  act(() => {
    vv.height = 700;
    vv.listeners.forEach((l) => l());
  });
  flush();
  expect(kb()).toBe("closed");
});

test("open where the keyboard also shrinks the layout viewport (Android resizes-content)", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  act(() => {
    setInner(460);
    vv.height = 460;
    vv.listeners.forEach((l) => l());
  });
  flush();
  expect(kb()).toBe("open");
});

test("always closed on a fine pointer", () => {
  stubMatchMedia([]);
  stubViewport(300);
  render(<Probe />);
  flush();
  expect(kb()).toBe("closed");
});

test("closed where visualViewport is unavailable", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  vi.stubGlobal("visualViewport", undefined);
  render(<Probe />);
  expect(kb()).toBe("closed");
});

test("closed on the server", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  stubViewport(300);
  expect(renderToString(<Probe />)).toContain("closed");
});
