import { reduce, describe as describeCmd, testContext } from "~/engine/reducer";
import { assignOccurrences, refundSeats } from "~/engine/distribute";
import { seededRng } from "~/engine/rng";
import { emptyWorkspace } from "~/engine/empty";
import { capacities } from "~/engine/capacity";
import { ValidationError, NoCapacityError, NotEnoughTAsError, type Command } from "~/engine/types";
import { ctx, run, team } from "./fixtures";

test("addTA assigns distinct colours and trims the name", () => {
  const ws = run([{ type: "addTA", name: "  Ahmed " }, { type: "addTA", name: "Basma" }]);
  expect(ws.tas.map(t => t.name)).toEqual(["Ahmed", "Basma"]);
  expect(ws.tas[0].color).not.toBe(ws.tas[1].color);
});
test("rejects blank names", () => {
  expect(() => run([{ type: "addTA", name: "   " }])).toThrow(ValidationError);
  expect(() => run([{ type: "addSection", name: "" }])).toThrow(ValidationError);
  expect(() => run([{ type: "addTA", name: "A" }, { type: "createTask", kind: "light", title: " ", schedule: { type: "one-time", date: "2026-10-01" } }])).toThrow(ValidationError);
});
test("sections slots drive capacity", () => {
  const ws = run([{ type: "addTA", name: "A" }, { type: "addSection", name: "S1" }]);
  const [ta] = ws.tas; const [sec] = ws.sections;
  const ws2 = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 0, taId: ta.id }, ctx);
  expect(capacities(ws2)[ta.id]).toBe(1);
  expect(capacities(reduce(ws2, { type: "removeSection", sectionId: sec.id }, ctx))[ta.id]).toBe(0);
});
test("createTask generates and assigns occurrences, advancing the ledger", () => {
  const { ws } = team();
  const out = reduce(ws, { type: "createTask", kind: "light", title: "Quiz", schedule: { type: "weekly", start: "2026-10-01", end: "2026-10-22" } }, ctx);
  expect(out.tasks[0].occurrences).toHaveLength(4);
  expect(out.tasks[0].createdAt).toBe("2026-10-16T12:00:00.000Z");
  expect(Object.values(out.ledgers.light.used).reduce((a, b) => a + b, 0)).toBe(4);
});
test("createTask with no sections throws NoCapacityError", () => {
  const ws = run([{ type: "addTA", name: "A" }]);
  expect(() => reduce(ws, { type: "createTask", kind: "light", title: "X", schedule: { type: "one-time", date: "2026-10-01" } }, ctx)).toThrow(NoCapacityError);
});
test("removeTA re-assigns its occurrences to the others", () => {
  const { ws, id } = team();
  const withTask = reduce(ws, { type: "createTask", kind: "light", title: "Quiz", schedule: { type: "daily", start: "2026-10-01", end: "2026-10-08" } }, ctx);
  const out = reduce(withTask, { type: "removeTA", taId: id("D") }, ctx);
  expect(out.tas.map(t => t.name)).toEqual(["A", "B", "C"]);
  expect(out.sections.every(s => !s.taIds.includes(id("D")))).toBe(true);
  expect(out.tasks[0].occurrences).toHaveLength(8);
  expect(out.tasks[0].occurrences.every(o => o.seats[0].taId !== id("D"))).toBe(true);
  expect(out.ledgers.light.used[id("D")]).toBeUndefined();
});
test("removeTA throws NoCapacityError and leaves workspace unchanged when nobody else has capacity", () => {
  const ws0 = run([{ type: "addTA", name: "A" }, { type: "addTA", name: "B" }, { type: "addSection", name: "S" }]);
  const ws = reduce(ws0, { type: "setSectionSlot", sectionId: ws0.sections[0].id, slot: 0, taId: ws0.tas[0].id }, ctx);
  const withTask = reduce(ws, { type: "createTask", kind: "light", title: "X", schedule: { type: "one-time", date: "2026-10-01" } }, ctx);
  const before = structuredClone(withTask);
  expect(() => reduce(withTask, { type: "removeTA", taId: ws.tas[0].id }, ctx)).toThrow(NoCapacityError);
  expect(withTask).toEqual(before);
});
test("setSemester with end before start is rejected; shrinking end truncates occurrences", () => {
  const { ws } = team();
  expect(() => reduce(ws, { type: "setSemester", semester: { name: "x", start: "2026-10-10", end: "2026-10-01" } }, ctx)).toThrow(ValidationError);
  const t = reduce(ws, { type: "createTask", kind: "light", title: "Q", schedule: { type: "weekly", start: "2026-10-01", end: null } }, ctx);
  const cut = reduce(t, { type: "setSemester", semester: { ...t.semester, end: "2026-10-20" } }, ctx);
  expect(cut.tasks[0].occurrences.map(o => o.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
});
test("reset returns the empty workspace", () => {
  const { ws } = team();
  expect(reduce(ws, { type: "reset" }, ctx)).toEqual(emptyWorkspace());
});
test("reduce never mutates its input", () => {
  const ws = emptyWorkspace(); const frozen = JSON.stringify(ws);
  reduce(ws, { type: "addTA", name: "A" }, ctx);
  expect(JSON.stringify(ws)).toBe(frozen);
});
test("describe produces human labels", () => {
  const ws = run([{ type: "addTA", name: "Ahmed" }]);
  expect(describeCmd({ type: "addTA", name: "Ahmed" }, ws)).toBe('Added TA "Ahmed"');
  expect(describeCmd({ type: "removeTA", taId: ws.tas[0].id }, ws)).toBe('Removed TA "Ahmed"');
  expect(describeCmd({ type: "reset" }, ws)).toBe("Reset everything");
});
test("an unknown command is rejected", () => {
  const { ws } = team();
  expect(() => reduce(ws, { type: "launchRocket" } as unknown as Command, ctx)).toThrow(new ValidationError("Unknown command."));
});
test("setSectionSlot rejects a slot other than 0 or 1", () => {
  const { ws, id } = team();
  const bad = { type: "setSectionSlot", sectionId: ws.sections[0].id, slot: 2, taId: id("A") } as unknown as Command;
  expect(() => reduce(ws, bad, ctx)).toThrow(new ValidationError("Invalid slot."));
});
test("unknown ids are rejected", () => {
  const { ws } = team();
  const ref = { taskId: "nope", occurrenceId: "nope" };
  const cases: [Command, string][] = [
    [{ type: "renameTA", taId: "nope", name: "X" }, "Unknown TA."],
    [{ type: "removeTA", taId: "nope" }, "Unknown TA."],
    [{ type: "renameSection", sectionId: "nope", name: "X" }, "Unknown section."],
    [{ type: "setSectionSlot", sectionId: ws.sections[0].id, slot: 0, taId: "nope" }, "Unknown TA."],
    [{ type: "removeSection", sectionId: "nope" }, "Unknown section."],
    [{ type: "updateTask", taskId: "nope", title: "X" }, "Unknown task."],
    [{ type: "deleteTask", taskId: "nope" }, "Unknown task."],
    [{ type: "redistributeTask", taskId: "nope" }, "Unknown task."],
    [{ type: "reassignOccurrence", ref, from: ws.tas[1].id, taId: ws.tas[0].id }, "Unknown task."],
  ];
  for (const [cmd, message] of cases) expect(() => reduce(ws, cmd, ctx)).toThrow(new ValidationError(message));
  const t = reduce(ws, { type: "createTask", kind: "light", title: "Q", schedule: { type: "one-time", date: "2026-10-01" } }, ctx);
  const badOcc = { taskId: t.tasks[0].id, occurrenceId: "nope" };
  expect(() => reduce(t, { type: "reassignOccurrence", ref: badOcc, from: ws.tas[1].id, taId: ws.tas[0].id }, ctx)).toThrow(new ValidationError("Unknown occurrence."));
  const good = { taskId: t.tasks[0].id, occurrenceId: t.tasks[0].occurrences[0].id };
  expect(() => reduce(t, { type: "reassignOccurrence", ref: good, from: t.tasks[0].occurrences[0].seats[0].taId, taId: "nope" }, ctx)).toThrow(new ValidationError("Unknown TA."));
});
test("describe labels slots, reassignments and swaps", () => {
  const { ws, id } = team();
  const t = reduce(ws, { type: "createTask", kind: "light", title: "Q", schedule: { type: "daily", start: "2026-10-03", end: "2026-10-04" } }, ctx);
  const [o1, o2] = t.tasks[0].occurrences;
  const name = (taId: string) => t.tas.find(x => x.id === taId)!.name;
  const sec = t.sections[0];
  expect(describeCmd({ type: "setSectionSlot", sectionId: sec.id, slot: 0, taId: id("C") }, t)).toBe("Assigned C to S1");
  expect(describeCmd({ type: "setSectionSlot", sectionId: sec.id, slot: 1, taId: null }, t)).toBe("Cleared a slot in S1");
  expect(describeCmd({ type: "reassignOccurrence", ref: { taskId: t.tasks[0].id, occurrenceId: o1.id }, from: o1.seats[0].taId, taId: id("B") }, t)).toBe("Reassigned Oct 3 to B");
  expect(describeCmd({ type: "swapOccurrences", a: { taskId: t.tasks[0].id, occurrenceId: o1.id, taId: o1.seats[0].taId }, b: { taskId: t.tasks[0].id, occurrenceId: o2.id, taId: o2.seats[0].taId } }, t))
    .toBe(`Swapped ${name(o1.seats[0].taId)} ↔ ${name(o2.seats[0].taId)}`);
});

test("removeTA refills only the removed TA's seats with a distinct TA", () => {
  const { ws, id } = team();
  const t = reduce(ws, { type: "createTask", kind: "light", title: "Pair", taCount: 2, schedule: { type: "daily", start: "2026-10-01", end: "2026-10-04" } }, ctx);
  const out = reduce(t, { type: "removeTA", taId: id("A") }, ctx);
  out.tasks[0].occurrences.forEach((o, i) => {
    const ids = o.seats.map(s => s.taId);
    expect(o.seats).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain(id("A"));
    for (const old of t.tasks[0].occurrences[i].seats) {
      if (old.taId === id("A")) continue;
      expect(o.seats).toContainEqual(old);
    }
    const kept = new Set(t.tasks[0].occurrences[i].seats.filter(s => s.taId !== id("A")).map(s => s.taId));
    for (const s of o.seats) if (!kept.has(s.taId)) expect(s.turn).toBe(out.ledgers.light.turn);
  });
});
test("removeTA is rejected when a seat cannot be refilled", () => {
  let w = run([{ type: "addTA", name: "X" }, { type: "addTA", name: "Y" }, { type: "addSection", name: "S" }]);
  w = run([
    { type: "setSectionSlot", sectionId: w.sections[0].id, slot: 0, taId: w.tas[0].id },
    { type: "setSectionSlot", sectionId: w.sections[0].id, slot: 1, taId: w.tas[1].id },
    { type: "createTask", kind: "light", title: "Pair", taCount: 2, schedule: { type: "daily", start: "2026-10-01", end: "2026-10-02" } },
  ], w);
  const before = structuredClone(w);
  expect(() => reduce(w, { type: "removeTA", taId: w.tas[0].id }, ctx)).toThrow(NotEnoughTAsError);
  expect(() => reduce(w, { type: "removeTA", taId: w.tas[0].id }, ctx)).toThrow(new NotEnoughTAsError(2, 1, "Pair"));
  expect(() => reduce(w, { type: "removeTA", taId: w.tas[0].id }, ctx)).toThrow('"Pair" needs 2 TAs on each date but only 1 has sections.');
  expect(w).toEqual(before);
});
test("describe labels co-staffed tasks", () => {
  const { ws } = team();
  const schedule = { type: "one-time", date: "2026-10-01" } as const;
  expect(describeCmd({ type: "createTask", kind: "heavy", title: "Lab", taCount: 2, schedule }, ws)).toBe('Added heavy task "Lab" for 2 TAs');
  expect(describeCmd({ type: "createTask", kind: "heavy", title: "Lab", taCount: 1, schedule }, ws)).toBe('Added heavy task "Lab"');
});

test("removeTA refills orphaned dates in date order across tasks, like one date-sorted deal", () => {
  const { ws, id } = team();
  // Two 1-TA tasks whose dates interleave: X on Oct 1, 8, 15, …; Y on Oct 4, 11, 18, ….
  let w = reduce(ws, { type: "createTask", kind: "light", title: "X", schedule: { type: "weekly", start: "2026-10-01", end: "2026-11-30" } }, ctx);
  w = reduce(w, { type: "createTask", kind: "light", title: "Y", schedule: { type: "weekly", start: "2026-10-04", end: "2026-11-30" } }, ctx);
  const D = id("D");
  const orphans = w.tasks
    .flatMap((t) => t.occurrences.filter((o) => o.seats.some((s) => s.taId === D)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // The fixture only proves something if D's dates interleave across both tasks.
  const owner = (occId: string) => w.tasks.find((t) => t.occurrences.some((o) => o.id === occId))!.title;
  expect(new Set(orphans.map((o) => owner(o.id)))).toEqual(new Set(["X", "Y"]));
  expect(orphans.map((o) => owner(o.id))).not.toEqual([...orphans.map((o) => owner(o.id))].sort());

  const out = reduce(w, { type: "removeTA", taId: D }, testContext(7));
  const used = { ...refundSeats(w.ledgers.light, orphans.flatMap((o) => o.seats)).used };
  delete used[D];
  const expected = assignOccurrences({
    capacities: capacities(out),
    ledger: { turn: w.ledgers.light.turn, used },
    occurrences: orphans.map((o) => ({ id: o.id, date: o.date })),
    taCount: 1,
    rng: seededRng(7),
  });
  const refilled = new Map(out.tasks.flatMap((t) => t.occurrences).map((o) => [o.id, o]));
  expect(orphans.map((o) => refilled.get(o.id))).toEqual(expected.occurrences);
  expect(out.ledgers.light).toEqual(expected.ledger);
});
