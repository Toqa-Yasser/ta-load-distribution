// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionsBoard } from "~/components/team/SectionsBoard";
import type { Section } from "~/engine/types";
const tas = [
  { id: "A", name: "Ahmed", color: "#f00" },
  { id: "B", name: "Bassem", color: "#0f0" },
];
const board = (sections: Section[], props: Partial<Parameters<typeof SectionsBoard>[0]> = {}) => (
  <SectionsBoard sections={sections} tas={tas}
    onAddSection={() => {}} onRename={() => {}} onSetSlot={() => {}} onRemove={() => {}} {...props} />
);
const filled: Section[] = [{ id: "s1", name: "S1", taIds: ["A", null] }];

test("tapping an empty slot and choosing a TA calls onSetSlot", () => {
  const onSetSlot = vi.fn();
  render(board([{ id: "s1", name: "S1", taIds: [null, null] }], { onSetSlot }));
  fireEvent.click(screen.getAllByRole("button", { name: /empty slot/i })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Ahmed" }));
  expect(onSetSlot).toHaveBeenCalledWith("s1", 0, "A");
});
test("Clear empties a filled slot", () => {
  const onSetSlot = vi.fn();
  render(board(filled, { onSetSlot }));
  fireEvent.click(screen.getByRole("button", { name: "Slot 1 of S1: Ahmed" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(onSetSlot).toHaveBeenCalledWith("s1", 0, null);
});
test("the slot picker ignores a pick of the TA already in the slot", () => {
  const onSetSlot = vi.fn();
  render(board(filled, { onSetSlot }));
  fireEvent.click(screen.getByRole("button", { name: "Slot 1 of S1: Ahmed" }));
  fireEvent.click(screen.getByRole("button", { name: "Ahmed", pressed: true }));
  expect(onSetSlot).not.toHaveBeenCalled();
});
test("the slot picker keeps its title and Clear while it animates out", () => {
  render(board(filled));
  fireEvent.click(screen.getByRole("button", { name: "Slot 1 of S1: Ahmed" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  // Still mounted for its exit animation: the content must not fall back to the placeholder.
  expect(screen.getByRole("heading", { name: "S1 · slot 1" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pick a TA" })).toBeNull();
  expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
});
test("remove-section confirm names the section and keeps its body while closing", () => {
  const onRemove = vi.fn();
  render(board(filled, { onRemove }));
  fireEvent.click(screen.getByRole("button", { name: "Remove S1" }));
  const body = '"S1" will be removed; the TAs in it lose its capacity.';
  expect(screen.getByText(body)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(onRemove).toHaveBeenCalledWith("s1");
  expect(screen.getByText(body)).toBeInTheDocument();
});
test("pending disables the Add section button", () => {
  render(board([], { pending: true }));
  fireEvent.change(screen.getByLabelText("New section"), { target: { value: "S2" } });
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
});
