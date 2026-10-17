import { taStats } from "~/components/dashboard/stats";
import { emptyWorkspace } from "~/engine/empty";

test("taStats reports used per kind and counts per kind", () => {
  const ws = emptyWorkspace();
  ws.tas = [{ id: "A", name: "Ahmed", color: "#f00" }, { id: "B", name: "Bo", color: "#0f0" }] as any;
  ws.ledgers.light.used = { A: 3 };
  ws.ledgers.heavy.used = { A: 1, B: 2 };
  const occ = (id: string, taId: string, date: string) => ({ id, date, seats: [{ taId, turn: 1 }] });
  ws.tasks = [
    { id: "t1", title: "Q", kind: "light", occurrences: [occ("1", "A", "2026-10-20"), occ("2", "A", "2026-10-21"), occ("3", "A", "2026-10-22")] },
    { id: "t2", title: "P", kind: "heavy", occurrences: [occ("4", "A", "2026-10-23"), occ("5", "B", "2026-10-24")] },
  ] as any;
  const s = taStats(ws, "2026-10-17");
  expect(s.A.used).toEqual({ light: 3, heavy: 1 });
  expect(s.B.used).toEqual({ light: 0, heavy: 2 });
  expect(s.A.counts).toEqual({ light: 3, heavy: 1 });
  expect(s.B.counts).toEqual({ light: 0, heavy: 1 });
  expect(s.A.totalOccurrences).toBe(4);
  expect(s.A.nextDates).toHaveLength(3);
});

test("taStats keeps at most three distinct upcoming dates, ascending, and ignores unknown TAs", () => {
  const ws = emptyWorkspace();
  ws.tas = [{ id: "A", name: "Ahmed", color: "#f00" }] as any;
  const occ = (id: string, taId: string, date: string) => ({ id, date, seats: [{ taId, turn: 1 }] });
  ws.tasks = [
    { id: "t1", title: "Q", kind: "light", occurrences: [
      occ("1", "A", "2026-10-30"), occ("2", "A", "2026-10-18"), occ("3", "A", "2026-10-16"),
      occ("4", "A", "2026-10-25"), occ("5", "A", "2026-10-18"), occ("6", "ghost", "2026-10-17") ] },
  ] as any;
  const s = taStats(ws, "2026-10-17");
  expect(s.A.nextDates.map((d) => d.date)).toEqual(["2026-10-18", "2026-10-25", "2026-10-30"]);
  expect(s.A.totalOccurrences).toBe(5);
  expect(s.ghost).toBeUndefined();
});

test("each upcoming date lists the TA's task titles on that day, in task order, without repeats", () => {
  const ws = emptyWorkspace();
  ws.tas = [{ id: "A", name: "Ahmed", color: "#f00" }, { id: "B", name: "Bo", color: "#0f0" }] as any;
  const occ = (id: string, taId: string, date: string) => ({ id, date, seats: [{ taId, turn: 1 }] });
  ws.tasks = [
    { id: "t1", title: "Quiz", kind: "light", occurrences: [occ("1", "A", "2026-10-18"), occ("2", "A", "2026-10-18"), occ("3", "B", "2026-10-19")] },
    { id: "t2", title: "Lab", kind: "heavy", occurrences: [occ("4", "A", "2026-10-18"), occ("5", "A", "2026-10-20")] },
  ] as any;
  const s = taStats(ws, "2026-10-17");
  expect(s.A.nextDates).toEqual([
    { date: "2026-10-18", titles: ["Quiz", "Lab"] },
    { date: "2026-10-20", titles: ["Lab"] },
  ]);
  expect(s.B.nextDates).toEqual([{ date: "2026-10-19", titles: ["Quiz"] }]);
});

test("taStats counts seats", () => {
  const ws = emptyWorkspace();
  ws.tas = [{ id: "A", name: "Ahmed", color: "#f00" }, { id: "B", name: "Bo", color: "#0f0" }] as any;
  ws.tasks = [
    { id: "t1", title: "Lab", kind: "heavy", occurrences: [{ id: "1", date: "2026-10-20", seats: [{ taId: "A", turn: 1 }, { taId: "B", turn: 1 }] }] },
  ] as any;
  const s = taStats(ws, "2026-10-17");
  for (const id of ["A", "B"]) {
    expect(s[id].totalOccurrences).toBe(1);
    expect(s[id].counts).toEqual({ light: 0, heavy: 1 });
    expect(s[id].nextDates).toEqual([{ date: "2026-10-20", titles: ["Lab"] }]);
  }
});
