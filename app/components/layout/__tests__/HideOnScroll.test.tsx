// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { ThemeProvider } from "~/lib/theme";
import { Header } from "../Header";
import { NavBar } from "../NavBar";

const direction = vi.hoisted(() => ({ value: "up" as "up" | "down" }));
const scrollHookCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("~/lib/use-scroll-direction", () => ({
  useScrollDirection: () => {
    scrollHookCalls.n++;
    return direction.value;
  },
}));

const HIDE_UP = "-translate-y-[calc(100%+12px)]";
const HIDE_DOWN = "translate-y-[calc(100%+12px+env(safe-area-inset-bottom))]";

function renderBars() {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <>
          <Header />
          <NavBar placement="bottom" />
        </>
      ),
    },
  ]);
  return render(
    <ThemeProvider>
      <Stub initialEntries={["/"]} />
    </ThemeProvider>,
  );
}

const classes = (el: Element) => el.className.split(/\s+/);

afterEach(() => {
  direction.value = "up";
});

test("header and tab bar get the hidden transform when direction is down", async () => {
  direction.value = "down";
  const { container } = renderBars();
  const header = await screen.findByRole("banner");
  const tabbar = container.querySelector("nav[data-tabbar]")!;
  expect(classes(header)).toContain(HIDE_UP);
  expect(classes(header)).not.toContain("translate-y-0");
  expect(classes(tabbar)).toContain(HIDE_DOWN);
  expect(header.getAttribute("data-hidden")).toBe("true");
  expect(tabbar.getAttribute("data-hidden")).toBe("true");
});

test("header and tab bar sit in place when direction is up", async () => {
  const { container } = renderBars();
  const header = await screen.findByRole("banner");
  const tabbar = container.querySelector("nav[data-tabbar]")!;
  for (const el of [header, tabbar]) {
    expect(classes(el)).toContain("translate-y-0");
    expect(el.className).not.toContain("calc(100%+12px");
    expect(el.hasAttribute("data-hidden")).toBe(false);
  }
});

test("the bars slide with a 220ms ease-out transform, instant under reduced motion", async () => {
  const { container } = renderBars();
  const header = await screen.findByRole("banner");
  const tabbar = container.querySelector("nav[data-tabbar]")!;
  for (const el of [header, tabbar]) {
    expect(classes(el)).toEqual(
      expect.arrayContaining(["transition-transform", "duration-220", "ease-[cubic-bezier(0.22,1,0.36,1)]", "motion-reduce:transition-none"]),
    );
  }
});

test("a focused control inside a hidden header brings it back", async () => {
  direction.value = "down";
  renderBars();
  const header = await screen.findByRole("banner");
  expect(classes(header)).toContain("has-[:focus-visible]:translate-y-0");
});

test("the header-placement nav does not subscribe to scroll direction", () => {
  scrollHookCalls.n = 0;
  const Stub = createRoutesStub([{ path: "*", Component: () => <NavBar placement="header" /> }]);
  render(<Stub initialEntries={["/"]} />);
  expect(scrollHookCalls.n).toBe(0);
});
