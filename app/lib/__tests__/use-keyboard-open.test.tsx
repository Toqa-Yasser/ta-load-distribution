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
  const vv = { height, scale: 1, listeners: [] as Listener[], addEventListener: (_: string, l: Listener) => vv.listeners.push(l), removeEventListener() {} };
  vi.stubGlobal("visualViewport", vv);
  return vv;
}
function stubMatchMedia(matching: string[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: matching.includes(q), media: q, addEventListener() {}, removeEventListener() {} }));
}
const frames: FrameRequestCallback[] = [];
const flush = () => act(() => frames.splice(0).forEach((cb) => cb(0)));
const focusField = () => {
  const input = document.body.appendChild(document.createElement("input"));
  act(() => input.focus());
  return input;
};
const shrink = (vv: ReturnType<typeof stubViewport>, h: number) => {
  act(() => {
    vv.height = h;
    vv.listeners.forEach((l) => l());
  });
  flush();
};
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
  document.body.innerHTML = "";
});

test("open while a field is focused and the visual viewport is more than 150px shorter than the window (iOS)", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  focusField();
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
  focusField();
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
  focusField();
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

test("shrink with no focused field is not the keyboard (split-screen)", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  shrink(vv, 380);
  expect(kb()).toBe("closed");
});

test("pinch-zoom is not the keyboard", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  focusField();
  vv.scale = 1.5;
  shrink(vv, 460);
  expect(kb()).toBe("closed");
});

test("blur closes immediately even if the height stays shrunk", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  const input = focusField();
  shrink(vv, 460);
  expect(kb()).toBe("open");
  act(() => input.blur());
  expect(kb()).toBe("closed");
});

test("a height-only resize while unfocused becomes the new baseline", () => {
  stubMatchMedia(["(pointer: coarse)"]);
  const vv = stubViewport(800);
  render(<Probe />);
  setInner(500);
  shrink(vv, 500);
  expect(kb()).toBe("closed");
  const input = focusField();
  shrink(vv, 350); // 150 below the new 500 baseline
  expect(kb()).toBe("open");
  act(() => input.blur());
  expect(kb()).toBe("closed");
});
