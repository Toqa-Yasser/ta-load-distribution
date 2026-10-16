// @vitest-environment jsdom
import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { TAList } from "~/components/team/TAList";

const tas = [{ id: "A", name: "Ahmed", color: "#f00" }];
const ui = (count: number) => (
  <DndContext>
    <TAList tas={tas} capacities={{ A: 1 }} occurrenceCounts={{ A: count }}
      onAdd={() => {}} onRename={() => {}} onRemove={() => {}} />
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
