import { fmtMonth, monthCells, occurrencesByDate, shiftMonth } from "~/lib/calendar";

test("monthCells starts on Monday and covers 42 days", () => {
  const cells = monthCells("2026-10");
  expect(cells).toHaveLength(42);
  expect(cells[0].date).toBe("2026-09-28");
  expect(cells.filter(c => c.inMonth)).toHaveLength(31);
});

test("occurrencesByDate groups by date in task order", () => {
  const tasks = [
    { id: "t1", title: "A", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [
      { id: "1", date: "2026-10-05", taId: "A", turn: 1 }, { id: "2", date: "2026-10-06", taId: "A", turn: 1 }] },
    { id: "t2", title: "B", createdAt: "", schedule: { type: "one-time", date: "x" }, occurrences: [
      { id: "3", date: "2026-10-05", taId: "B", turn: 1 }] },
  ];
  const map = occurrencesByDate(tasks as any);
  expect(map.get("2026-10-05")?.map((e) => e.occ.id)).toEqual(["1", "3"]);
  expect(map.get("2026-10-06")?.map((e) => e.task.id)).toEqual(["t1"]);
  expect(map.has("2026-10-07")).toBe(false);
});

test("shiftMonth crosses year boundaries and fmtMonth names the month", () => {
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(fmtMonth("2026-10")).toBe("October 2026");
});

test("monthCells spills into neighbouring years", () => {
  const dec = monthCells("2026-12");
  expect(dec.at(-1)).toEqual({ date: "2027-01-10", inMonth: false });
  expect(dec.filter((c) => c.date.startsWith("2027-01")).every((c) => !c.inMonth)).toBe(true);
  const jan = monthCells("2026-01");
  expect(jan[0]).toEqual({ date: "2025-12-29", inMonth: false });
  expect(jan.filter((c) => c.inMonth)).toHaveLength(31);
});
