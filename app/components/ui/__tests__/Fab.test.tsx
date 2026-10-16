// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { Fab, FAB_SLOT_ID } from "~/components/ui/Fab";

test("Fab portals into #fab-slot, outside the (animated) route tree", () => {
  const onClick = vi.fn();
  render(
    <>
      <main data-testid="page">
        <Fab label="New task" onClick={onClick}>+</Fab>
      </main>
      <div id={FAB_SLOT_ID} data-testid="slot" />
    </>,
  );
  const fab = screen.getByRole("button", { name: "New task" });
  expect(screen.getByTestId("slot").contains(fab)).toBe(true);
  expect(screen.getByTestId("page").contains(fab)).toBe(false);
  expect(fab.className.split(/\s+/)).toEqual(expect.arrayContaining(["fixed", "size-14"]));
  fireEvent.click(fab);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("Fab renders nothing without a slot", () => {
  render(<Fab label="New task" onClick={() => {}}>+</Fab>);
  expect(screen.queryByRole("button", { name: "New task" })).not.toBeInTheDocument();
});
