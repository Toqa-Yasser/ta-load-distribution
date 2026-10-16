// @vitest-environment jsdom
import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { TAList } from "~/components/team/TAList";

const tas = [{ id: "A", name: "Ahmed", color: "#f00" }];
type Props = Partial<Parameters<typeof TAList>[0]>;
const ui = (count: number, props: Props = {}) => (
  <DndContext>
    <TAList tas={tas} capacities={{ A: 1 }} occurrenceCounts={{ A: count }}
      onAdd={() => {}} onRename={() => {}} onRemove={() => {}} {...props} />
  </DndContext>
);

test("remove confirm pluralises the occurrence count", () => {
  const { unmount } = render(ui(1));
  fireEvent.click(screen.getByRole("button", { name: "Remove Ahmed" }));
  expect(screen.getByText(/Ahmed has 1 task occurrence;/)).toBeInTheDocument();
  unmount();
  render(ui(3));
  fireEvent.click(screen.getByRole("button", { name: "Remove Ahmed" }));
  expect(screen.getByText(/Ahmed has 3 task occurrences;/)).toBeInTheDocument();
});
test("remove confirm body is the full sentence and survives the closing animation", () => {
  const onRemove = vi.fn();
  render(ui(2, { onRemove }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Ahmed" }));
  const body = "Ahmed has 2 task occurrences; they will be re-distributed to the other TAs.";
  expect(screen.getByText(body)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(onRemove).toHaveBeenCalledWith("A");
  expect(screen.getByText(body)).toBeInTheDocument();
});

const startRename = () => {
  fireEvent.click(screen.getByRole("button", { name: /^Ahmed/ }));
  return screen.getByRole("textbox", { name: "Rename Ahmed" });
};
test("rename: Enter commits the new name", () => {
  const onRename = vi.fn();
  render(ui(0, { onRename }));
  const input = startRename();
  fireEvent.change(input, { target: { value: "Amr" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRename).toHaveBeenCalledWith("A", "Amr");
  expect(screen.queryByRole("textbox", { name: "Rename Ahmed" })).toBeNull();
});
test("rename: Escape cancels", () => {
  const onRename = vi.fn();
  render(ui(0, { onRename }));
  const input = startRename();
  fireEvent.change(input, { target: { value: "Amr" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(onRename).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", { name: "Rename Ahmed" })).toBeNull();
});
test("rename: a blank name is not submitted", () => {
  const onRename = vi.fn();
  render(ui(0, { onRename }));
  const input = startRename();
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRename).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", { name: "Rename Ahmed" })).toBeNull();
});
test("the chip explains tap and drag", () => {
  render(ui(0));
  expect(screen.getByRole("button", { name: /^Ahmed/ })).toHaveAttribute("title", "Tap to rename, drag to a slot");
});
test("pending disables the Add TA button", () => {
  render(ui(0, { pending: true }));
  fireEvent.change(screen.getByLabelText("New TA"), { target: { value: "Bassem" } });
  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
});
