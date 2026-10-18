// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { TACard } from "~/components/dashboard/TACard";

const renderCard = (nextDates: { date: string; titles: string[] }[] = []) =>
  render(
    <TACard
      ta={{ id: "A", name: "Ahmed", color: "#f00" } as any}
      capacity={4}
      used={{ light: 2, heavy: 1 }}
      counts={{ light: 3, heavy: 1, equal: 2 }}
      totalOccurrences={4}
      nextDates={nextDates}
      onSwap={() => {}}
    />,
  );

test("TACard renders two gauges labelled Light and Heavy", () => {
  renderCard();
  expect(screen.getByLabelText("Ahmed light: 50% used")).toBeInTheDocument();
  expect(screen.getByLabelText("Ahmed heavy: 25% used")).toBeInTheDocument();
  expect(screen.getByText("3 light · 1 heavy · 2 equal")).toBeInTheDocument();
  expect(screen.getAllByRole("img")).toHaveLength(2);
});

test("the kind captions under the gauges are neutral, so the TA colour is the card's only colour", () => {
  renderCard();
  for (const kind of ["Light", "Heavy"]) {
    const caption = screen.getByText(kind);
    expect(caption.className).toContain("text-muted");
    expect(caption.className).not.toMatch(/text-(light|heavy)\b/);
  }
});

test("Swap is an icon button in the card header, before the gauges", () => {
  renderCard();
  const swap = screen.getByRole("button", { name: "Swap one of Ahmed's dates" });
  const header = screen.getByRole("heading", { name: "Ahmed" }).closest("header")!;
  expect(header).toContainElement(swap);
  expect(swap).toHaveAttribute("title", "Swap a date");
});

test("each Next date chip names its tasks in a tooltip", () => {
  renderCard([{ date: "2026-10-18", titles: ["Quiz", "Lab"] }]);
  const chip = screen.getByText("Oct 18").closest("[data-badge]")!;
  expect(chip).toHaveAttribute("title", "Quiz, Lab");
  expect(within(chip as HTMLElement).getByText(": Quiz, Lab")).toHaveClass("sr-only");
});

test("date chips are keyboard-reachable (no button) with an inset focus ring", () => {
  renderCard([{ date: "2026-10-18", titles: ["Quiz"] }, { date: "2026-10-20", titles: ["Lab"] }]);
  const chips = [...document.querySelectorAll<HTMLElement>("[data-badge]")];
  expect(chips).toHaveLength(2);
  for (const chip of chips) {
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveAttribute("tabindex", "0");
    expect(chip.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["focus-visible:outline-2", "focus-visible:-outline-offset-2", "focus-visible:outline-accent"]),
    );
  }
  chips[0].focus();
  expect(chips[0]).toHaveFocus();
  expect(screen.queryAllByRole("button").filter((b) => b.closest("dd"))).toHaveLength(0);
});
