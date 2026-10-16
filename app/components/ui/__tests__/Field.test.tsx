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
