import { applyPendingSlots } from "~/components/team/optimistic";
import type { Section } from "~/engine/types";

const sections: Section[] = [
  { id: "s1", name: "S1", taIds: ["A", null] },
  { id: "s2", name: "S2", taIds: [null, "B"] },
];

test("pending slot commands overlay the sections in order", () => {
  const out = applyPendingSlots(sections, [
    { type: "setSectionSlot", sectionId: "s1", slot: 1, taId: "B" },
    { type: "setSectionSlot", sectionId: "s2", slot: 1, taId: null },
    { type: "setSectionSlot", sectionId: "s1", slot: 1, taId: "A" }, // a later pick wins
  ]);
  expect(out.map((s) => s.taIds)).toEqual([["A", "A"], [null, null]]);
  expect(sections[0].taIds).toEqual(["A", null]); // input untouched
});

test("with nothing pending the same sections come back", () => {
  expect(applyPendingSlots(sections, [])).toBe(sections);
});

test("a command for a section that no longer exists is ignored", () => {
  expect(applyPendingSlots(sections, [{ type: "setSectionSlot", sectionId: "gone", slot: 0, taId: "A" }])).toEqual(sections);
});
