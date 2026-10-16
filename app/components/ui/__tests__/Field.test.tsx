// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Field } from "~/components/ui/Field";

const describedIds = (el: HTMLElement) => (el.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);

test("describes the control by its hint", () => {
  render(<Field label="End" hint="Optional"><input /></Field>);
  const ids = describedIds(screen.getByLabelText("End"));
  expect(ids).toHaveLength(1);
  expect(document.getElementById(ids[0])).toHaveTextContent("Optional");
});
test("an error replaces the hint without leaving a dangling id", () => {
  render(<Field label="End" hint="Optional" error="Too early"><input /></Field>);
  const ids = describedIds(screen.getByLabelText("End"));
  expect(ids).toHaveLength(1);
  expect(document.getElementById(ids[0])).toHaveTextContent("Too early");
});
test("the aria-live region persists across hint → error → cleared", () => {
  const ui = (error?: string) => <Field label="End" hint="Optional" error={error}><input /></Field>;
  const { container, rerender } = render(ui());
  const region = container.querySelector("[aria-live]");
  expect(region).not.toBeNull();
  expect(region).toBeEmptyDOMElement();
  rerender(ui("Too early"));
  expect(container.querySelector("[aria-live]")).toBe(region);
  expect(region).toHaveTextContent("Too early");
  rerender(ui());
  expect(container.querySelector("[aria-live]")).toBe(region);
  expect(region).toBeEmptyDOMElement();
  expect(describedIds(screen.getByLabelText("End")).map((id) => document.getElementById(id)?.textContent)).toEqual(["Optional"]);
});
