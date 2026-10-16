// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionsBoard } from "~/components/team/SectionsBoard";
const tas = [{ id: "A", name: "Ahmed", color: "#f00" }];
test("tapping an empty slot and choosing a TA calls onSetSlot", () => {
  const onSetSlot = vi.fn();
  render(<SectionsBoard sections={[{ id: "s1", name: "S1", taIds: [null, null] }]} tas={tas}
    onAddSection={() => {}} onRename={() => {}} onSetSlot={onSetSlot} onRemove={() => {}} />);
  fireEvent.click(screen.getAllByRole("button", { name: /empty slot/i })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Ahmed" }));
  expect(onSetSlot).toHaveBeenCalledWith("s1", 0, "A");
});
