// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { Card } from "~/components/ui/Card";

test("an interactive card promotes a layer only while a mouse is tilting it", () => {
  const { container } = render(<Card interactive>hi</Card>);
  const card = container.firstElementChild as HTMLElement;
  expect(card).not.toHaveClass("will-change-transform");
  fireEvent.pointerMove(card, { pointerType: "mouse", clientX: 5, clientY: 5 });
  expect(card).toHaveClass("will-change-transform");
  fireEvent.pointerLeave(card);
  expect(card).not.toHaveClass("will-change-transform");
});
