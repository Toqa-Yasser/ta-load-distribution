// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useScrolled } from "~/lib/use-scrolled";

function Probe() {
  return <p>{useScrolled() ? "scrolled" : "top"}</p>;
}

const scrollTo = (y: number) =>
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });

afterEach(() => Object.defineProperty(window, "scrollY", { value: 0, configurable: true }));

test("useScrolled is false at the top and true past the threshold", () => {
  render(<Probe />);
  expect(screen.getByText("top")).toBeInTheDocument();
  scrollTo(8);
  expect(screen.getByText("top")).toBeInTheDocument();
  scrollTo(9);
  expect(screen.getByText("scrolled")).toBeInTheDocument();
  scrollTo(0);
  expect(screen.getByText("top")).toBeInTheDocument();
});

test("useScrolled picks up a page that is already scrolled on mount", () => {
  Object.defineProperty(window, "scrollY", { value: 400, configurable: true });
  render(<Probe />);
  expect(screen.getByText("scrolled")).toBeInTheDocument();
});

test("useScrolled renders false on the server", () => {
  Object.defineProperty(window, "scrollY", { value: 400, configurable: true });
  expect(renderToString(<Probe />)).toContain("top");
});
