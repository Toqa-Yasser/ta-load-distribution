// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { TAOrderList } from "~/components/tasks/TAOrderList";
import type { TA } from "~/engine/types";

const A: TA = { id: "A", name: "Ahmed", color: "#f00" };
const B: TA = { id: "B", name: "Bassem", color: "#0f0" };
const C: TA = { id: "C", name: "Carla", color: "#00f" };
const tas = [A, B, C];

test("lists TAs in the given order with positions", () => {
  render(<TAOrderList tas={tas} order={["C", "A", "B"]} onChange={() => {}} />);
  const items = within(screen.getByRole("list", { name: "Order" })).getAllByRole("listitem");
  expect(items.map((li) => within(li).getByText(/^\d+\.$/).textContent)).toEqual(["1.", "2.", "3."]);
  expect(items.map((li, i) => within(li).getByText(["Carla", "Ahmed", "Bassem"][i]))).toHaveLength(3);
});

test("Move down swaps with the next row", () => {
  const onChange = vi.fn();
  render(<TAOrderList tas={tas} order={["A", "B", "C"]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Move Ahmed down" }));
  expect(onChange).toHaveBeenCalledWith(["B", "A", "C"]);
  fireEvent.click(screen.getByRole("button", { name: "Move Carla up" }));
  expect(onChange).toHaveBeenLastCalledWith(["A", "C", "B"]);
});

test("the first up and last down buttons are disabled", () => {
  render(<TAOrderList tas={tas} order={["A", "B", "C"]} onChange={() => {}} />);
  expect(screen.getByRole("button", { name: "Move Ahmed up" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move Carla down" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Move Ahmed down" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Move Bassem up" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Move Bassem down" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Move Carla up" })).toBeEnabled();
});

test("Team list order resets to team order and is disabled when already matching", () => {
  const onChange = vi.fn();
  const { rerender } = render(<TAOrderList tas={tas} order={["C", "B", "A"]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Team list order" }));
  expect(onChange).toHaveBeenCalledWith(["A", "B", "C"]);
  rerender(<TAOrderList tas={tas} order={["A", "B", "C"]} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Team list order" })).toBeDisabled();
  // The pressed button is now disabled, so focus moves to the first row instead of <body>.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move Ahmed down" }));
});

test("with no TAs it shows the message and no list", () => {
  render(<TAOrderList tas={[]} order={[]} onChange={() => {}} />);
  expect(screen.getByText("Add TAs on the Team page first.")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

function Harness({ initial }: { initial: string[] }) {
  const [order, setOrder] = useState(initial);
  return <TAOrderList tas={tas} order={order} onChange={setOrder} />;
}

test("focus stays on the moved TA's button, switching to the other one at a bound", () => {
  render(<Harness initial={["A", "B", "C"]} />);
  const button = (name: string) => screen.getByRole("button", { name });
  fireEvent.click(button("Move Ahmed down"));
  expect(document.activeElement).toBe(button("Move Ahmed down"));
  fireEvent.click(button("Move Ahmed down"));
  expect(button("Move Ahmed down")).toBeDisabled();
  expect(document.activeElement).toBe(button("Move Ahmed up"));
  // Order is now Bassem, Carla, Ahmed.
  fireEvent.click(button("Move Carla up"));
  expect(button("Move Carla up")).toBeDisabled();
  expect(document.activeElement).toBe(button("Move Carla down"));
  // Order is now Carla, Bassem, Ahmed.
  fireEvent.click(button("Move Ahmed up"));
  expect(document.activeElement).toBe(button("Move Ahmed up"));
});
