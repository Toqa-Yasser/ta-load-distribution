// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { DayCell } from "~/components/calendar/DayCell";
import { OccurrencePill } from "~/components/calendar/OccurrencePill";
import type { Occurrence, Task } from "~/engine/types";

const SARA = { id: "S", name: "Sara", color: "rgb(255, 0, 0)" };
const OMAR = { id: "O", name: "Omar", color: "rgb(0, 255, 0)" };
const NOUR = { id: "N", name: "Nour", color: "rgb(0, 0, 255)" };
const taById = new Map([SARA, OMAR, NOUR].map((t) => [t.id, t]));

// jsdom serialises colours as rgb() and drops a gradient's default direction (`to bottom`), so the
// fixtures use rgb() colours and the stripe is checked by its colour stops.
const occ = (id: string, date: string, ...taIds: string[]): Occurrence => ({
  id,
  date,
  seats: taIds.map((taId) => ({ taId, turn: 1 })),
});
const task = (id: string, title: string, kind: Task["kind"], taCount: number, occurrences: Occurrence[]): Task => ({
  id, title, kind, createdAt: "", schedule: { type: "one-time", date: "x" }, taCount, occurrences,
});

test("overflow toggle has a 44px hit area", () => {
  const t = task("t", "Quiz", "light", 1, []);
  const entries = [1, 2, 3, 4, 5].map((n) => ({ task: t, occ: occ(String(n), "2026-10-05", "A") }));
  render(<DayCell date="2026-10-05" inMonth isToday={false} entries={entries} taById={new Map()}
    selected={null} swapSource={null} swapFrom={null} onSelect={() => {}} />);
  for (const btn of screen.getAllByRole("button", { name: /^Show \d+ more/ })) {
    expect(btn.className.split(/\s+/)).toContain("min-h-11");
  }
});

test("multi-seat pill names every TA", () => {
  const lab = task("l", "Lab", "heavy", 2, [occ("1", "2026-10-05", "S", "O")]);
  render(<OccurrencePill task={lab} occ={lab.occurrences[0]} tas={[SARA, OMAR]} selected={false} swapRole={null} onClick={() => {}} />);
  const btn = screen.getByRole("button", { name: "Lab · Oct 5 · Sara, Omar · Heavy" });
  const stripe = btn.querySelector<HTMLElement>("[data-stripe]")!;
  expect(stripe).toHaveAttribute("aria-hidden");
  expect(stripe.style.background).toBe("linear-gradient(rgb(255, 0, 0) 0% 50%, rgb(0, 255, 0) 50% 100%)");
  expect(btn.style.backgroundImage).toBe(
    "linear-gradient(to right, color-mix(in srgb, rgb(255, 0, 0) 28%, transparent), color-mix(in srgb, rgb(0, 255, 0) 28%, transparent))",
  );
  expect(btn.style.borderLeftColor).toBe("transparent");
});

test("three-seat stripe has one equal band per seat, in seat order", () => {
  const lab = task("l", "Lab", "heavy", 3, [occ("1", "2026-10-05", "S", "O", "N")]);
  render(<OccurrencePill task={lab} occ={lab.occurrences[0]} tas={[SARA, OMAR, NOUR]} selected={false} swapRole={null} onClick={() => {}} />);
  const btn = screen.getByRole("button", { name: "Lab · Oct 5 · Sara, Omar, Nour · Heavy" });
  expect(btn.querySelector<HTMLElement>("[data-stripe]")!.style.background).toBe(
    "linear-gradient(rgb(255, 0, 0) 0% 33.33%, rgb(0, 255, 0) 33.33% 66.67%, rgb(0, 0, 255) 66.67% 100%)",
  );
});

test("an unknown seat TA renders as Unassigned", () => {
  const lab = task("l", "Lab", "heavy", 2, [occ("1", "2026-10-05", "S", "gone")]);
  render(<OccurrencePill task={lab} occ={lab.occurrences[0]} tas={[SARA, undefined]} selected={false} swapRole={null} onClick={() => {}} />);
  const btn = screen.getByRole("button", { name: "Lab · Oct 5 · Sara, Unassigned · Heavy" });
  expect(btn.querySelector("[data-stripe]")!.getAttribute("style")).toContain("var(--muted)");
});

test("single-seat pill is unchanged", () => {
  const quiz = task("q", "Quiz", "light", 1, [occ("1", "2026-10-05", "S")]);
  render(<OccurrencePill task={quiz} occ={quiz.occurrences[0]} tas={[SARA]} selected={false} swapRole={null} onClick={() => {}} />);
  const btn = screen.getByRole("button", { name: "Quiz · Oct 5 · Sara · Light" });
  expect(btn.className.split(/\s+/)).toContain("border-l-4");
  expect(btn.style.borderLeftColor).toBe("rgb(255, 0, 0)");
  const style = btn.getAttribute("style") ?? "";
  expect(style).toContain("color-mix(in srgb, rgb(255, 0, 0) 22%, transparent)");
  expect(style).not.toContain("gradient");
  expect(btn.querySelector("[data-stripe]")).toBeNull();
});

test("DayCell dims pills with no swappable seat and pulses those with one", () => {
  const lab = task("l", "Lab", "heavy", 2, [
    occ("1", "2026-10-05", "S", "O"),
    occ("2", "2026-10-05", "O", "N"), // Omar is already on the source, Nour is free
    occ("3", "2026-10-05", "O", "S"), // Sara is already here
  ]);
  const quiz = task("q", "Quiz", "light", 1, [occ("4", "2026-10-05", "N")]);
  const entries = [...lab.occurrences.map((o) => ({ task: lab, occ: o })), { task: quiz, occ: quiz.occurrences[0] }];
  const onSelect = vi.fn();
  render(
    <DayCell date="2026-10-05" inMonth isToday={false} entries={entries} taById={taById} selected={null} expanded
      swapSource={{ taskId: "l", occurrenceId: "1", taId: "S" }}
      swapFrom={{ task: lab, occ: lab.occurrences[0], taId: "S" }} onSelect={onSelect} />,
  );
  const classes = (name: string) => screen.getByRole("button", { name }).className.split(/\s+/);
  expect(classes("Lab · Oct 5 · Sara, Omar · Heavy · swapping")).toContain("ring-accent-2");
  expect(classes("Lab · Oct 5 · Omar, Nour · Heavy")).toContain("animate-swap-pulse");
  expect(classes("Lab · Oct 5 · Omar, Nour · Heavy")).not.toContain("opacity-40");
  expect(classes("Lab · Oct 5 · Omar, Sara · Heavy")).toContain("opacity-40");
  expect(classes("Quiz · Oct 5 · Nour · Light")).toContain("opacity-40");
  fireEvent.click(screen.getByRole("button", { name: "Lab · Oct 5 · Omar, Nour · Heavy" }));
  expect(onSelect).toHaveBeenCalledWith({ taskId: "l", occurrenceId: "2" });
});

test("an Equal task's pill carries the equal kind dot", () => {
  const eq = { ...task("e", "Rota", "equal", 1, [occ("1", "2026-10-05", "S")]), taOrder: ["S"] };
  const { container } = render(<OccurrencePill task={eq} occ={eq.occurrences[0]} tas={[SARA]} selected={false} swapRole={null} onClick={() => {}} />);
  const dot = container.querySelector('[data-kind="equal"]');
  expect(dot).not.toBeNull();
  expect(dot!.className.split(/\s+/)).toContain("bg-equal");
});
