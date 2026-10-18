// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TAOrderList } from "~/components/tasks/TAOrderList";
import type { TA } from "~/engine/types";

const A: TA = { id: "A", name: "Ahmed", color: "#f00" };
const B: TA = { id: "B", name: "Bassem", color: "#0f0" };
const C: TA = { id: "C", name: "Carla", color: "#00f" };
const tas = [A, B, C];

test("lists TAs in the given order with positions", () => {
  render(<TAOrderList tas={tas} order={["C", "A", "B"]} onChange={() => {}} />);
  const items = within(screen.getByRole("list", { name: "Order" })).getAllByRole("listitem");
  expect(items.map((li) => li.textContent)).toEqual(["1.Carla", "2.Ahmed", "3.Bassem"]);
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
});

test("with no TAs it shows the message and no list", () => {
  render(<TAOrderList tas={[]} order={[]} onChange={() => {}} />);
  expect(screen.getByText("Add TAs on the Team page first.")).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
