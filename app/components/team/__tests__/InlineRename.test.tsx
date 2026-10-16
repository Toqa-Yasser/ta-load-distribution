// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineRename } from "~/components/team/InlineRename";
test("Enter commits the trimmed value", () => {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(<InlineRename value="Old" label="Rename Old" onCommit={onCommit} onCancel={onCancel} />);
  const input = screen.getByRole("textbox", { name: "Rename Old" });
  fireEvent.change(input, { target: { value: "  New  " } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
  expect(onCommit).toHaveBeenCalledTimes(1);
  expect(onCommit).toHaveBeenCalledWith("New");
  expect(onCancel).not.toHaveBeenCalled();
});
test("Escape cancels without calling onCommit", () => {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(<InlineRename value="Old" label="Rename Old" onCommit={onCommit} onCancel={onCancel} />);
  const input = screen.getByRole("textbox", { name: "Rename Old" });
  fireEvent.change(input, { target: { value: "New" } });
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.blur(input);
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onCommit).not.toHaveBeenCalled();
});
