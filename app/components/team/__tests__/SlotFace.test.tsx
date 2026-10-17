// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { SlotFace } from "~/components/team/SectionCard";

const A = { id: "A", name: "Ahmed", color: "#f00" };
const B = { id: "B", name: "Bassem", color: "#0f0" };

test("an empty slot invites a tap or a drop, and asks for the drop while dragging", () => {
  const { rerender } = render(<SlotFace ta={undefined} incoming={undefined} dragging={false} />);
  expect(screen.getByText("Tap or drop a TA")).toBeInTheDocument();
  rerender(<SlotFace ta={undefined} incoming={undefined} dragging />);
  expect(screen.getByText("Drop here")).toBeInTheDocument();
});

test("a hovered slot previews the incoming TA instead of its label", () => {
  render(<SlotFace ta={undefined} incoming={A} dragging />);
  expect(screen.queryByText("Drop here")).not.toBeInTheDocument();
  expect(screen.getByText("Ahmed")).toHaveAttribute("data-ghost");
});

test("a filled slot previews the replacement over its current TA", () => {
  render(<SlotFace ta={A} incoming={B} dragging />);
  expect(screen.getByText("Bassem")).toHaveAttribute("data-ghost");
  expect(screen.queryByText("Ahmed")).not.toBeInTheDocument();
});

test("hovering a slot with the TA it already holds changes nothing", () => {
  render(<SlotFace ta={A} incoming={A} dragging />);
  expect(screen.getByText("Ahmed")).not.toHaveAttribute("data-ghost");
});
