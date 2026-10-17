import type { Occurrence, Task } from "~/engine/types";
import { swappableSeats } from "~/lib/swap";

const occ = (id: string, ...taIds: string[]): Occurrence => ({
  id,
  date: "2026-10-05",
  seats: taIds.map((taId) => ({ taId, turn: 1 })),
});
const task = (id: string, kind: Task["kind"], ...occurrences: Occurrence[]): Task => ({
  id,
  title: id,
  kind,
  createdAt: "",
  schedule: { type: "one-time", date: "2026-10-05" },
  taCount: occurrences[0]?.seats.length ?? 1,
  occurrences,
});

const lab = task("lab", "heavy", occ("l1", "A", "B"), occ("l2", "C", "D"), occ("l3", "B", "C"), occ("l4", "D", "C", "E"));
const exam = task("exam", "heavy", occ("x1", "C"));
const quiz = task("quiz", "light", occ("q1", "C"));
const source = { task: lab, occ: lab.occurrences[0], taId: "A" };

test.each([
  ["the same occurrence", { task: lab, occ: lab.occurrences[0] }, []],
  ["another kind", { task: quiz, occ: quiz.occurrences[0] }, []],
  ["an occurrence the source TA already sits on", { task: lab, occ: occ("l5", "C", "A") }, []],
  ["a seat held only by the source TA", { task: lab, occ: occ("l6", "A") }, []],
  ["a seat already held on the source occurrence", { task: lab, occ: lab.occurrences[2] }, ["C"]],
  ["an occurrence whose every seat is held on the source", { task: lab, occ: occ("l7", "B") }, []],
  ["every free seat, in seat order", { task: lab, occ: lab.occurrences[3] }, ["D", "C", "E"]],
  ["a single seat of another task of the same kind", { task: exam, occ: exam.occurrences[0] }, ["C"]],
  ["two free seats", { task: lab, occ: lab.occurrences[1] }, ["C", "D"]],
])("swappableSeats: %s", (_, target, expected) => {
  expect(swappableSeats(source, target)).toEqual(expected);
});
